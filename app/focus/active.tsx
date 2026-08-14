import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, BackHandler, AppState, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { supabase } from '@/services/supabase';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function FocusActiveScreen() {
  const router = useRouter();
  const {
    activeSession,
    completeSession,
    breakSession,
    subjects,
    streakRecoveryPending,
    lostStreakCount,
    setStreakRecoveryPending,
    isLoading,
  } = useApp();

  const [elapsed, setElapsed] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [showExit, setShowExit] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const startTimeRef = useRef(
    activeSession?.startedAt ? new Date(activeSession.startedAt).getTime() : Date.now()
  );
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompletingRef = useRef(false);
  const rtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const rtChannelIdRef = useRef(0);

  // ✅ Store subscription objects in refs so cleanup always has latest reference
  const appStateSubRef = useRef<{ remove?: () => void } | null>(null);
  const backSubRef = useRef<{ remove?: () => void } | null>(null);

  const plannedMins = activeSession?.plannedMins ?? 25;
  const plannedSecs = plannedMins * 60;

  const subjectName = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.name ?? 'General'
    : 'General';

  const subjectColor = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.colorHex ?? Colors.primary
    : Colors.primary;

  const handleComplete = async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    setIsProcessing(true);

    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      const actualMins = Math.floor(elapsedRef.current / 60);
      const session = await completeSession(activeSession.sessionId, actualMins);
      const isRecovery = streakRecoveryPending;
      const recoveredStreak = lostStreakCount;

      const comebackParam = (session as any)?.comebackBonus > 0 ? '1' : '0';
      const xpEarned = session?.xpEarned ?? 0;

      if (isRecovery) setStreakRecoveryPending(false, 0);

      if (session?.leveledUp && session?.newLevelRank) {
        const { LEVELS } = await import('@/constants/levels');
        const levelDef = LEVELS.find(l => l.rank === session.newLevelRank);
        const totalXPAfter = session?.totalXP ?? xpEarned;
        router.replace(
          `/focus/levelup?newLevel=${session.newLevelRank}&title=${encodeURIComponent(levelDef?.realisticTitle ?? '')}&examTitle=${encodeURIComponent(levelDef?.examTitle ?? '')}&color=${encodeURIComponent(levelDef?.color ?? '#A855F7')}&totalXP=${totalXPAfter}&xpEarned=${xpEarned}&recovery=${isRecovery ? '1' : '0'}&lostStreak=${recoveredStreak}`
        );
      } else {
        router.replace(`/focus/complete?xp=${xpEarned}&comeback=${comebackParam}&recovery=${isRecovery ? '1' : '0'}&lostStreak=${recoveredStreak}`);
      }
    } catch (error) {
      console.error("Silent Complete Error:", error);
      router.replace(`/focus/complete?xp=0&comeback=0`);
    }
  };

  const handleBreak = async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    setIsProcessing(true);

    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      const actualMins = Math.max(0, Math.floor(elapsedRef.current / 60));
      const session = await breakSession(activeSession.sessionId, actualMins);
      router.replace(`/focus/broken?penalty=${session?.xpDeducted || 0}`);
    } catch (error) {
      console.error("Silent Break Error:", error);
      router.replace('/focus/broken?penalty=0');
    }
  };

  const tick = () => {
    if (isCompletingRef.current) return;
    const currentElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const currentRemaining = Math.max(0, plannedSecs - currentElapsed);

    elapsedRef.current = currentElapsed;
    setElapsed(currentElapsed);

    if (currentRemaining <= 0) {
      handleComplete();
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!activeSession) {
      router.replace('/(tabs)/focus');
      return;
    }

    startTimeRef.current = activeSession.startedAt
      ? new Date(activeSession.startedAt).getTime()
      : Date.now();
    const alreadyElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const initialRemaining = Math.max(0, plannedSecs - alreadyElapsed);
    elapsedRef.current = alreadyElapsed;
    setElapsed(alreadyElapsed);
    intervalRef.current = setInterval(tick, 500);

    // ✅ Bulletproof AppState listener setup
    try {
      const sub = AppState.addEventListener('change', next => {
        if (appStateRef.current === 'active' && next !== 'active') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (appStateRef.current !== 'active' && next === 'active') {
          intervalRef.current = setInterval(tick, 500);
        }
        appStateRef.current = next;
      });
      appStateSubRef.current = sub ?? null;
    } catch (e) {
      console.log('AppState setup failed:', e);
      appStateSubRef.current = null;
    }

    // ✅ Bulletproof BackHandler setup
    if (Platform.OS === 'android') {
      try {
        const handler = () => { setShowExit(true); return true; };
        const sub = BackHandler.addEventListener('hardwareBackPress', handler);
        backSubRef.current = sub ?? null;
      } catch (e) {
        console.log('BackHandler setup failed:', e);
        backSubRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);

      // ✅ Absolute safe cleanup — checks existence AND type before calling
      const asub = appStateSubRef.current;
      if (asub && typeof asub.remove === 'function') {
        asub.remove();
      }
      appStateSubRef.current = null;

      const bsub = backSubRef.current;
      if (bsub && typeof bsub.remove === 'function') {
        bsub.remove();
      }
      backSubRef.current = null;
    };
  }, [isLoading]);

  useEffect(() => {
    if (!activeSession?.sessionId) return;

    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current);
      rtChannelRef.current = null;
    }

    rtChannelIdRef.current += 1;
    const channelName = `focus-active-${activeSession.sessionId}-${rtChannelIdRef.current}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'focus_sessions',
          filter: `id=eq.${activeSession.sessionId}`,
        },
        (payload: any) => {
          if (isCompletingRef.current) return;
          const updated = payload.new;

          if (updated?.broken === false && updated?.ended_at) {
            isCompletingRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            router.replace(`/focus/complete?xp=${updated.xp_earned ?? 0}`);
            return;
          }

          if (updated?.broken === true) {
            isCompletingRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            router.replace(`/focus/broken?penalty=${updated.xp_deducted ?? 0}`);
            return;
          }
        }
      )
      .subscribe();

    rtChannelRef.current = channel;

    return () => {
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current);
        rtChannelRef.current = null;
      }
    };
  }, [activeSession?.sessionId]);

  const remaining = Math.max(0, plannedSecs - elapsed);
  const progress = Math.min(1, elapsed / (plannedSecs || 1));

  const handleTripleTap = () => {
    if (isProcessing) return;
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (tapTimer.current) clearTimeout(tapTimer.current);

    if (newCount >= 3) {
      setTapCount(0);
      setShowExit(true);
    } else {
      tapTimer.current = setTimeout(() => setTapCount(0), 1000);
    }
  };

  if (!activeSession) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.fullScreen} onPress={handleTripleTap} activeOpacity={1}>
        <View style={styles.subjectTag}>
          <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
          <Text style={styles.subjectText}>{subjectName}</Text>
        </View>

        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>REMAINING</Text>
          <Text style={styles.timerText}>{formatTime(remaining)}</Text>
          <Text style={styles.timerSub}>of {plannedMins} min session</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress * 100)}% complete</Text>
        </View>

        <Text style={styles.hint}>
          {tapCount > 0 ? `${3 - tapCount} more taps for emergency exit` : 'Triple tap for emergency exit'}
        </Text>

        <View style={styles.motivationStrip}>
          <MaterialIcons name="lock" size={14} color={Colors.primary} />
          <Text style={styles.motivationText}>Locked In — Focus Mode Active</Text>
        </View>
      </TouchableOpacity>

      {showExit && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <MaterialIcons name="warning" size={36} color={Colors.danger} />
            <Text style={styles.exitTitle}>Do you want to break the session? </Text>
            <Text style={styles.exitSub}>
              The streak will be reset.{'\n'}XP will be deducted.{'\n'} There is a need to focus well
            </Text>
            <TouchableOpacity
              style={[styles.exitConfirm, isProcessing && { opacity: 0.5 }]}
              onPress={handleBreak}
              disabled={isProcessing}
            >
              <Text style={styles.exitConfirmText}>{isProcessing ? 'Processing...' : 'Yes Break it.'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exitCancel}
              onPress={() => setShowExit(false)}
              disabled={isProcessing}
            >
              <Text style={styles.exitCancelText}>Regain your Focus</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  subjectTag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xxl },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  timerSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  timerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: Colors.textTertiary, letterSpacing: 2, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  timerText: { fontSize: 96, fontWeight: FontWeight.extraBold, color: Colors.textPrimary, letterSpacing: -2, includeFontPadding: false },
  timerSub: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: Spacing.sm },
  progressContainer: { width: '100%', marginBottom: Spacing.md },
  progressTrack: { height: 6, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressPct: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },
  motivationStrip: { position: 'absolute', bottom: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6 },
  motivationText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, letterSpacing: 0.5 },
  exitOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  exitCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.danger + '44', padding: Spacing.xl, alignItems: 'center', width: '100%' },
  exitTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginVertical: Spacing.sm, includeFontPadding: false },
  exitSub: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg },
  exitConfirm: { width: '100%', backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm },
  exitConfirmText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  exitCancel: { width: '100%', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  exitCancelText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
