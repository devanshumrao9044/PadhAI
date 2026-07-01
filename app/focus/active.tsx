import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, BackHandler, AppState, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
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
  const { activeSession, completeSession, breakSession, subjects } = useApp();
  
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [showExit, setShowExit] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use the actual session start time so the timer survives hot reloads / brief backgrounding
  const startTimeRef = useRef(
    activeSession?.startedAt ? new Date(activeSession.startedAt).getTime() : Date.now()
  );
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompletingRef = useRef(false);
  const rtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const plannedMins = activeSession?.plannedMins ?? 25;
  const plannedSecs = plannedMins * 60;

  const subjectName = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.name ?? 'General'
    : 'General';

  const subjectColor = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.colorHex ?? Colors.primary
    : Colors.primary;

  // 🚀 Silent & Bulletproof Complete Handler
  const handleComplete = async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    setIsProcessing(true);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    try {
      const actualMins = Math.floor(elapsedRef.current / 60);
      const session = await completeSession(activeSession.sessionId, actualMins);
      const comebackParam = (session as any)?.comebackBonus > 0 ? '1' : '0';
      const xpEarned = session?.xpEarned ?? 0;
      
      // If leveled up, go to levelup screen first
      if (session?.leveledUp && session?.newLevelRank) {
        const { LEVELS } = await import('@/constants/levels');
        const levelDef = LEVELS.find(l => l.rank === session.newLevelRank);
        const { useApp: _useApp } = await import('@/hooks/useApp');
        // Read total XP from session's post-completion state via the xpEarned + fallback
        const totalXPAfter = xpEarned; // approximate; dashboard will show real value
        router.replace(
          `/focus/levelup?newLevel=${session.newLevelRank}&title=${encodeURIComponent(levelDef?.realisticTitle ?? '')}&examTitle=${encodeURIComponent(levelDef?.examTitle ?? '')}&color=${encodeURIComponent(levelDef?.color ?? '#A855F7')}&totalXP=${totalXPAfter}&xpEarned=${xpEarned}`
        );
      } else {
        router.replace(`/focus/complete?xp=${xpEarned}&comeback=${comebackParam}`);
      }
    } catch (error) {
      console.error("Silent Complete Error:", error);
      // Fallback route so user never gets stuck
      router.replace(`/focus/complete?xp=0&comeback=0`);
    }
  };

  // 🚀 Silent & Bulletproof Break Handler
  const handleBreak = async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    setIsProcessing(true);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    try {
      const actualMins = Math.max(0, Math.floor(elapsedRef.current / 60));
      const session = await breakSession(activeSession.sessionId, actualMins);
      
      // Navigate smoothly
      router.replace(`/focus/broken?penalty=${session?.xpDeducted || 0}`);
    } catch (error) {
      console.error("Silent Break Error:", error);
      // Fallback route so user never gets stuck
      router.replace('/focus/broken?penalty=0');
    }
  };

  const tick = () => {
    if (isCompletingRef.current) return;
    const currentElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const currentRemaining = Math.max(0, plannedSecs - currentElapsed);
    
    elapsedRef.current = currentElapsed;
    setElapsed(currentElapsed);
    setRemaining(currentRemaining);
    
    if (currentRemaining <= 0) {
      handleComplete();
    }
  };

  useEffect(() => {
    if (!activeSession) {
      router.replace('/(tabs)/focus');
      return;
    }
    
    // Restore elapsed time based on when the session actually started
    startTimeRef.current = activeSession.startedAt
      ? new Date(activeSession.startedAt).getTime()
      : Date.now();
    const alreadyElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const initialRemaining = Math.max(0, plannedSecs - alreadyElapsed);
    elapsedRef.current = alreadyElapsed;
    setElapsed(alreadyElapsed);
    setRemaining(initialRemaining);
    intervalRef.current = setInterval(tick, 500);

    const appStateSub = AppState.addEventListener('change', next => {
      if (appStateRef.current === 'active' && next !== 'active') {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else if (appStateRef.current !== 'active' && next === 'active') {
        intervalRef.current = setInterval(tick, 500);
      }
      appStateRef.current = next;
    });

    let backSub: { remove: () => void } | null = null;
    if (Platform.OS === 'android') {
      const handler = () => { setShowExit(true); return true; };
      BackHandler.addEventListener('hardwareBackPress', handler);
      backSub = { remove: () => BackHandler.removeEventListener('hardwareBackPress', handler) };
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      appStateSub.remove();
      backSub?.remove();
    };
  }, []);

  // Real-time subscription: sync session state from another device
  useEffect(() => {
    if (!activeSession?.sessionId) return;

    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current);
    }

    const channel = supabase
      .channel(`focus-active-${activeSession.sessionId}`)
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

          // Session completed from another device
          if (updated?.completed === true) {
            isCompletingRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            router.replace(`/focus/complete?xp=${updated.xp_earned ?? 0}`);
            return;
          }

          // Session broken from another device
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
            <Text style={styles.exitTitle}>Session Todna Hai?</Text>
            <Text style={styles.exitSub}>
              Streak reset ho jayega.{'\n'}XP kata jayega.{'\n'}Ye hi problem hai tera.
            </Text>
            <TouchableOpacity 
              style={[styles.exitConfirm, isProcessing && { opacity: 0.5 }]} 
              onPress={handleBreak}
              disabled={isProcessing}
            >
              <Text style={styles.exitConfirmText}>{isProcessing ? 'Processing...' : 'Haan, tod do'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.exitCancel} 
              onPress={() => setShowExit(false)}
              disabled={isProcessing}
            >
              <Text style={styles.exitCancelText}>Wapas Focus Karo</Text>
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

