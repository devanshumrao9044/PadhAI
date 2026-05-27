import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, BackHandler, AppState, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';

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
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompletingRef = useRef(false);

  const plannedMins = activeSession?.plannedMins ?? 25;
  const plannedSecs = plannedMins * 60;

  const subjectName = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.name ?? 'General'
    : 'General';

  const subjectColor = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.colorHex ?? Colors.primary
    : Colors.primary;

  const handleComplete = useCallback(async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const actualMins = Math.floor(elapsed / 60);
    const session = await completeSession(activeSession.sessionId, actualMins);
    router.replace(`/focus/complete?xp=${session.xpEarned}`);
  }, [activeSession, elapsed]);

  const handleBreak = useCallback(async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const actualMins = Math.max(0, Math.floor(elapsed / 60));
    const session = await breakSession(activeSession.sessionId, actualMins);
    router.replace(`/focus/broken?penalty=${session.xpDeducted}`);
  }, [activeSession, elapsed]);

  useEffect(() => {
    if (!activeSession) {
      router.replace('/(tabs)/focus');
      return;
    }
    setRemaining(plannedSecs);
    startTimeRef.current = Date.now();

    const tick = () => {
      const e = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const r = Math.max(0, plannedSecs - e);
      setElapsed(e);
      setRemaining(r);
      if (r <= 0 && !isCompletingRef.current) {
        handleComplete();
      }
    };

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
      appStateSub.remove();
      backSub?.remove();
    };
  }, []);

  const progress = Math.min(1, elapsed / plannedSecs);

  const handleTripleTap = () => {
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

        {/* Subject label */}
        <View style={styles.subjectTag}>
          <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
          <Text style={styles.subjectText}>{subjectName}</Text>
        </View>

        {/* Timer */}
        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>REMAINING</Text>
          <Text style={styles.timerText}>{formatTime(remaining)}</Text>
          <Text style={styles.timerSub}>of {plannedMins} min session</Text>
        </View>

        {/* Progress arc / bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress * 100)}% complete</Text>
        </View>

        {/* Triple tap hint */}
        <Text style={styles.hint}>
          {tapCount > 0 ? `${3 - tapCount} more taps for emergency exit` : 'Triple tap for emergency exit'}
        </Text>

        {/* Motivational strip */}
        <View style={styles.motivationStrip}>
          <MaterialIcons name="lock" size={14} color={Colors.primary} />
          <Text style={styles.motivationText}>Locked In — Focus Mode Active</Text>
        </View>

      </TouchableOpacity>

      {/* Exit confirmation overlay */}
      {showExit ? (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <MaterialIcons name="warning" size={36} color={Colors.danger} />
            <Text style={styles.exitTitle}>Session Todna Hai?</Text>
            <Text style={styles.exitSub}>
              Streak reset ho jayega.{'\n'}XP kata jayega.{'\n'}Ye hi problem hai tera.
            </Text>
            <TouchableOpacity style={styles.exitConfirm} onPress={handleBreak}>
              <Text style={styles.exitConfirmText}>Haan, tod do</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitCancel} onPress={() => setShowExit(false)}>
              <Text style={styles.exitCancelText}>Wapas Focus Karo</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  fullScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl,
  },
  subjectTag: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xxl,
  },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  timerSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  timerLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 2, marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  timerText: {
    fontSize: 96, fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary, letterSpacing: -2, includeFontPadding: false,
  },
  timerSub: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: Spacing.sm },
  progressContainer: { width: '100%', marginBottom: Spacing.md },
  progressTrack: {
    height: 6, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.full, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  progressPct: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },
  motivationStrip: {
    position: 'absolute', bottom: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  motivationText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, letterSpacing: 0.5 },
  exitOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl,
  },
  exitCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.danger + '44',
    padding: Spacing.xl, alignItems: 'center', width: '100%',
  },
  exitTitle: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    color: Colors.textPrimary, marginVertical: Spacing.sm, includeFontPadding: false,
  },
  exitSub: {
    fontSize: FontSize.base, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg,
  },
  exitConfirm: {
    width: '100%', backgroundColor: Colors.danger,
    borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm,
  },
  exitConfirmText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  exitCancel: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center',
  },
  exitCancelText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
