import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, BackHandler, AppState, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { supabase } from '@/features/core/services/supabase';
import { isStreakRecoveryEligible, STREAK_RECOVERY_MINUTES } from '@/features/focus/services/streakRecovery';
import { haptics } from '@/features/core/services/haptics';
import { clearStudyGroupPresence, updateStudyGroupPresence } from '@/features/study-groups/services/studyGroups';
import { consumeFocusBreakRequest, startFocusGuard, stopFocusGuard } from '@/features/focus/services/focusGuard';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function FocusActiveScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const {
    activeSession,
    user,
    completeSession,
    breakSession,
    checkpointActiveSession,
    discardActiveSession,
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
  const [isOnline, setIsOnline] = useState(true);
  const startTimeRef = useRef(
    activeSession?.startedAt ? new Date(activeSession.startedAt).getTime() : Date.now()
  );
  const elapsedRef = useRef(activeSession?.checkpointElapsedSeconds ?? 0);
  const monotonicStartRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(activeSession?.checkpointElapsedSeconds ?? 0);
  const clockSampleRef = useRef({ wallMs: Date.now(), monotonicMs: 0 });
  const clockAnomalyRef = useRef(Boolean(activeSession?.clockAnomaly));
  const recoveryPromptShownRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompletingRef = useRef(false);
  const rtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const rtChannelIdRef = useRef(0);
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusGuardBreakHandledRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void NetInfo.fetch().then(state => {
      if (mounted) setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    const unsubscribe = NetInfo.addEventListener(state => {
      if (mounted) setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // ✅ Store subscription objects in refs so cleanup always has latest reference
  const appStateSubRef = useRef<{ remove?: () => void } | null>(null);
  const backSubRef = useRef<{ remove?: () => void } | null>(null);

  const plannedMins = activeSession?.plannedMins ?? 25;
  const plannedSecs = plannedMins * 60;

  const liveStateRef = useRef({
    activeSession,
    completeSession,
    breakSession,
    checkpointActiveSession,
    discardActiveSession,
    streakRecoveryPending,
    lostStreakCount,
    setStreakRecoveryPending,
    router,
    plannedSecs,
  });
  liveStateRef.current = {
    activeSession,
    completeSession,
    breakSession,
    checkpointActiveSession,
    discardActiveSession,
    streakRecoveryPending,
    lostStreakCount,
    setStreakRecoveryPending,
    router,
    plannedSecs,
  };

  const subjectName = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.name ?? t('focus.general')
    : t('focus.general');

  const subjectColor = activeSession?.subjectId
    ? subjects.find(s => s.id === activeSession.subjectId)?.colorHex ?? colors.primary
    : colors.primary;

  const handleFocusGuardBreak = useCallback(async () => {
    if (focusGuardBreakHandledRef.current || isCompletingRef.current || !consumeFocusBreakRequest()) return;
    const current = liveStateRef.current.activeSession;
    if (!current) return;
    focusGuardBreakHandledRef.current = true;
    isCompletingRef.current = true;
    setIsProcessing(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      const actualMins = Math.max(0, Math.floor(elapsedRef.current / 60));
      const broken = await liveStateRef.current.breakSession(current.sessionId, actualMins);
      void haptics.focusBroken();
      liveStateRef.current.router.replace(`/focus/broken?penalty=${broken?.xpDeducted ?? 0}&guard=1`);
    } catch {
      liveStateRef.current.router.replace('/focus/broken?penalty=0&guard=1');
    }
  }, []);

  const handleComplete = useCallback(async () => {
    const {
      activeSession: sessionToComplete,
      completeSession: complete,
      breakSession: breakCurrent,
      streakRecoveryPending: isRecovery,
      lostStreakCount: recoveredStreak,
      setStreakRecoveryPending: setRecovery,
      router: currentRouter,
    } = liveStateRef.current;
    if (isCompletingRef.current || !sessionToComplete) return;
    const recoveryLostStreak = sessionToComplete.recoveryLostStreak ?? recoveredStreak;
    isCompletingRef.current = true;
    setIsProcessing(true);

    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      const actualMins = Math.floor(elapsedRef.current / 60);
      const recoveryEligible = isStreakRecoveryEligible(Boolean(isRecovery), actualMins);
      if (!recoveryEligible) {
        const brokenSession = await breakCurrent(sessionToComplete.sessionId, actualMins);
        void haptics.focusBroken();
        setRecovery(false, 0);
        currentRouter.replace(`/focus/broken?penalty=${brokenSession?.xpDeducted ?? 0}&recovery=1&required=${STREAK_RECOVERY_MINUTES}`);
        return;
      }

      const session = await complete(sessionToComplete.sessionId, actualMins, elapsedRef.current);
      if (!session) {
        if (isRecovery) {
          const brokenSession = await breakCurrent(sessionToComplete.sessionId, actualMins);
          void haptics.focusBroken();
          setRecovery(false, 0);
          currentRouter.replace(`/focus/broken?penalty=${brokenSession?.xpDeducted ?? 0}&recovery=1&required=${STREAK_RECOVERY_MINUTES}`);
          return;
        }
        currentRouter.replace('/focus/complete?xp=0&comeback=0&rejected=1');
        return;
      }

      if ((session as any)?.syncRejected) {
        const reason = encodeURIComponent(String((session as any)?.syncError ?? 'verification_failed'));
        currentRouter.replace(`/focus/complete?xp=0&referralXp=0&comeback=0&recovery=0&rejected=1&reason=${reason}`);
        return;
      }
      const syncPending = Boolean((session as any)?.syncPending);
      const clockAnomaly = Boolean((session as any)?.clockAnomaly);
      if (!syncPending) void haptics.focusComplete();
      const comebackParam = (session as any)?.comebackBonus > 0 ? '1' : '0';
        const xpEarned = session?.xpEarned ?? 0;
        const referralXpAwarded = session?.referralXpAwarded ?? 0;

        if (isRecovery) setRecovery(false, 0);

      if (syncPending) {
        if (isRecovery) setRecovery(false, 0);
        currentRouter.replace(`/focus/complete?xp=0&referralXp=0&comeback=0&recovery=0&pending=1&clock=${clockAnomaly ? '1' : '0'}`);
        return;
      }

      if (session.leveledUp && session.newLevelRank) {
        const { LEVELS } = await import('@/constants/levels');
        const levelDef = LEVELS.find(l => l.rank === session.newLevelRank);
        const totalXPAfter = session?.totalXP ?? xpEarned;
                  currentRouter.replace(
          `/focus/levelup?newLevel=${session.newLevelRank}&title=${encodeURIComponent(levelDef?.realisticTitle ?? '')}&examTitle=${encodeURIComponent(levelDef?.examTitle ?? '')}&color=${encodeURIComponent(levelDef?.color ?? '#A855F7')}&totalXP=${totalXPAfter}&xpEarned=${xpEarned}&referralXp=${referralXpAwarded}&recovery=${isRecovery ? '1' : '0'}&lostStreak=${recoveryLostStreak}`
        );

      } else {
            currentRouter.replace(`/focus/complete?xp=${xpEarned}&referralXp=${referralXpAwarded}&comeback=${comebackParam}&recovery=${isRecovery ? '1' : '0'}&lostStreak=${recoveryLostStreak}`);
      }
    } catch (error) {
      console.error('Silent Complete Error:', error);
      if (isRecovery) {
        setRecovery(false, 0);
        currentRouter.replace(`/focus/broken?penalty=0&recovery=1&required=${STREAK_RECOVERY_MINUTES}`);
      } else {
        currentRouter.replace('/focus/complete?xp=0&comeback=0&rejected=1');
      }
    }
  }, []);

  const handleBreak = async () => {
    if (isCompletingRef.current || !activeSession) return;
    isCompletingRef.current = true;
    setIsProcessing(true);

    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      const actualMins = Math.max(0, Math.floor(elapsedRef.current / 60));
      const session = await breakSession(activeSession.sessionId, actualMins);
      const syncPending = Boolean((session as any)?.syncPending);
      if (!syncPending) void haptics.focusBroken();
      router.replace(`/focus/broken?penalty=${session?.xpDeducted || 0}&pending=${syncPending ? '1' : '0'}`);
    } catch (error) {
      console.error("Silent Break Error:", error);
      router.replace('/focus/broken?penalty=0');
    }
  };

  const monotonicNow = () => typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

  const tick = useCallback(() => {
    if (isCompletingRef.current || clockAnomalyRef.current) return;
    const nowMonotonic = monotonicNow();
    const nowWall = Date.now();
    const previous = clockSampleRef.current;
    const wallDelta = nowWall - previous.wallMs;
    const monotonicDelta = nowMonotonic - previous.monotonicMs;
    if (previous.monotonicMs > 0 && Math.abs(wallDelta - monotonicDelta) > 120_000) {
      clockAnomalyRef.current = true;
      void checkpointActiveSession(elapsedRef.current, true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setElapsed(elapsedRef.current);
      return;
    }
    const currentElapsed = baseElapsedRef.current + Math.max(0, Math.floor((nowMonotonic - (monotonicStartRef.current ?? nowMonotonic)) / 1000));
    const currentRemaining = Math.max(0, liveStateRef.current.plannedSecs - currentElapsed);

    elapsedRef.current = currentElapsed;
    clockSampleRef.current = { wallMs: nowWall, monotonicMs: nowMonotonic };
    setElapsed(currentElapsed);

    if (currentRemaining <= 0) {
      handleComplete();
    }
  }, [checkpointActiveSession, handleComplete]);

  useEffect(() => {
    if (isLoading) return;
    const currentSession = liveStateRef.current.activeSession;
    const currentRouter = liveStateRef.current.router;
    if (!currentSession) {
      currentRouter.replace('/(tabs)/focus');
      return;
    }

    startTimeRef.current = currentSession.startedAt
      ? new Date(currentSession.startedAt).getTime()
      : Date.now();
    const alreadyElapsed = currentSession.checkpointElapsedSeconds ?? 0;
    elapsedRef.current = alreadyElapsed;
    baseElapsedRef.current = alreadyElapsed;
    monotonicStartRef.current = monotonicNow();
    clockSampleRef.current = { wallMs: Date.now(), monotonicMs: monotonicStartRef.current };
    clockAnomalyRef.current = Boolean(currentSession.clockAnomaly);
    setElapsed(alreadyElapsed);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!clockAnomalyRef.current) intervalRef.current = setInterval(tick, 500);

    if (currentSession.status === 'interrupted' && !recoveryPromptShownRef.current) {
      recoveryPromptShownRef.current = true;
      setTimeout(() => {
        Alert.alert(
          t('focus.interruptedTitle'),
          t('focus.interruptedMessage', { value: alreadyElapsed }),
          [
            { text: t('focus.discardInterrupted'), style: 'destructive', onPress: () => { void discardActiveSession(); currentRouter.replace('/(tabs)/focus'); } },
            { text: t('focus.finishAndSync'), onPress: () => { void handleComplete(); } },
            { text: t('focus.continueSession'), onPress: () => { void checkpointActiveSession(alreadyElapsed, false); } },
          ],
        );
      }, 0);
    }

    const checkpointTimer = setInterval(() => {
      void checkpointActiveSession(elapsedRef.current, clockAnomalyRef.current);
    }, 10_000);

    // ✅ Bulletproof AppState listener setup
    try {
      const sub = AppState.addEventListener('change', next => {
        if (appStateRef.current === 'active' && next !== 'active') {
          // On Android, Focus Guard keeps the session alive while a verified study
          // app is foreground. Capture monotonic time before the JS timer is
          // background-throttled so the external study time is not lost.
          const nowMonotonic = monotonicNow();
          const currentElapsed = Platform.OS === 'android'
            ? baseElapsedRef.current + Math.max(0, Math.floor((nowMonotonic - (monotonicStartRef.current ?? nowMonotonic)) / 1000))
            : elapsedRef.current;
          elapsedRef.current = currentElapsed;
          clockSampleRef.current = { wallMs: Date.now(), monotonicMs: nowMonotonic };
          setElapsed(currentElapsed);
          void checkpointActiveSession(currentElapsed, clockAnomalyRef.current);
          if (Platform.OS !== 'android' && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (appStateRef.current !== 'active' && next === 'active') {
          const nowMonotonic = monotonicNow();
          const previous = clockSampleRef.current;
          const wallDelta = Date.now() - previous.wallMs;
          const monotonicDelta = nowMonotonic - previous.monotonicMs;
          if (previous.monotonicMs > 0 && Math.abs(wallDelta - monotonicDelta) > 120_000) {
            clockAnomalyRef.current = true;
            void checkpointActiveSession(elapsedRef.current, true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (Platform.OS === 'android' && !clockAnomalyRef.current) {
            const currentElapsed = baseElapsedRef.current + Math.max(0, Math.floor((nowMonotonic - (monotonicStartRef.current ?? nowMonotonic)) / 1000));
            elapsedRef.current = currentElapsed;
            setElapsed(currentElapsed);
          }
          void handleFocusGuardBreak();
          if (Platform.OS !== 'android') {
            baseElapsedRef.current = elapsedRef.current;
            monotonicStartRef.current = nowMonotonic;
          }
          clockSampleRef.current = { wallMs: Date.now(), monotonicMs: nowMonotonic };
          if (!clockAnomalyRef.current && !intervalRef.current) intervalRef.current = setInterval(tick, 500);
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
      clearInterval(checkpointTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = null;

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
  }, [isLoading, activeSession?.sessionId, activeSession?.startedAt, activeSession?.status, plannedSecs, tick, t, checkpointActiveSession, discardActiveSession, handleComplete, handleFocusGuardBreak]);

  useEffect(() => {
    if (!activeSession?.sessionId) return;
    focusGuardBreakHandledRef.current = false;
    void startFocusGuard();
    return () => {
      stopFocusGuard();
    };
  }, [activeSession?.sessionId]);

  useEffect(() => {
    const groupId = activeSession?.studyGroupId;
    const sessionId = activeSession?.sessionId;
    const userId = user?.id;
    if (!groupId || !sessionId || !userId) return;
    let active = true;
    const startedAt = activeSession.startedAt;
    const syncPresence = (status: 'studying' | 'paused') => {
      void updateStudyGroupPresence({ groupId, userId, sessionId, status, startedAt }).catch(() => undefined);
    };
    syncPresence(appStateRef.current === 'active' ? 'studying' : 'paused');
    presenceIntervalRef.current = setInterval(() => {
      if (active) syncPresence(appStateRef.current === 'active' ? 'studying' : 'paused');
    }, 30_000);
    const presenceAppStateSub = AppState.addEventListener('change', next => {
      if (active) syncPresence(next === 'active' ? 'studying' : 'paused');
    });
    return () => {
      active = false;
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = null;
      presenceAppStateSub.remove();
      void clearStudyGroupPresence(groupId, userId).catch(() => undefined);
    };
  }, [activeSession?.sessionId, activeSession?.startedAt, activeSession?.studyGroupId, user?.id]);

  useEffect(() => {
    const sessionId = activeSession?.sessionId;
    const currentRouter = liveStateRef.current.router;
    if (!sessionId) return;

    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current);
      rtChannelRef.current = null;
    }

    rtChannelIdRef.current += 1;
    const channelName = `focus-active-${sessionId}-${rtChannelIdRef.current}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'focus_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload: any) => {
          if (isCompletingRef.current) return;
          const updated = payload.new;

          if (updated?.broken === true) {
            isCompletingRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            void haptics.focusBroken();
            currentRouter.replace(`/focus/broken?penalty=${updated.xp_deducted ?? 0}`);
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
          <View style={[styles.syncBadge, clockAnomalyRef.current && styles.syncBadgeWarning]}>
            <MaterialIcons name={clockAnomalyRef.current ? 'schedule' : isOnline ? 'cloud-done' : 'cloud-off'} size={14} color={clockAnomalyRef.current ? colors.warning : isOnline ? colors.success : colors.primary} />
            <Text style={[styles.syncBadgeText, clockAnomalyRef.current && { color: colors.warning }, !clockAnomalyRef.current && !isOnline && { color: colors.primary }]}>
              {clockAnomalyRef.current ? t('focus.clockChangeDetected') : t('focus.syncReady')}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressPct}>{t('focus.percentComplete', { value: Math.round(progress * 100) })}</Text>
        </View>

        {Platform.OS === 'android' ? (
          <>
            <TouchableOpacity style={styles.allowedAppsButton} onPress={() => router.push('/focus/allowed-apps' as Parameters<typeof router.push>[0])} activeOpacity={0.85}>
              <MaterialIcons name="apps" size={18} color={colors.primary} />
              <Text style={styles.allowedAppsButtonText}>{t('focus.allowedAppsTitle')}</Text>
              <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
            </TouchableOpacity>
          </>
        ) : null}

        <Text style={styles.hint}>
          {tapCount > 0 ? t('focus.moreTaps', { value: 3 - tapCount }) : t('focus.tripleTapExit')}
        </Text>

        <View style={styles.motivationStrip}>
          <MaterialIcons name="lock" size={14} color={colors.primary} />
          <Text style={styles.motivationText}>{t('focus.lockedIn')}</Text>
        </View>
      </TouchableOpacity>


      {showExit && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <MaterialIcons name="warning" size={36} color={colors.danger} />
            <Text style={styles.exitTitle}>{t('focus.breakTitle')}</Text>
            <Text style={styles.exitSub}>{t('focus.breakMessage')}</Text>
            <TouchableOpacity
              style={[styles.exitConfirm, isProcessing && { opacity: 0.5 }]}
              onPress={handleBreak}
              disabled={isProcessing}
            >
              <Text style={styles.exitConfirmText}>{isProcessing ? t('focus.processing') : t('focus.breakSession')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exitCancel}
              onPress={() => setShowExit(false)}
              disabled={isProcessing}
            >
              <Text style={styles.exitCancelText}>{t('focus.regainFocus')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  subjectTag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.xxl },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.medium },
  timerSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  timerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  timerText: { fontSize: 96, fontWeight: FontWeight.extraBold, color: colors.textPrimary, letterSpacing: -2, includeFontPadding: false },
  timerSub: { fontSize: FontSize.base, color: colors.textSecondary, marginTop: Spacing.sm },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success + '44' },
  syncBadgeWarning: { backgroundColor: colors.warning + '18', borderColor: colors.warning + '44' },
  syncBadgeText: { fontSize: FontSize.xs, color: colors.success, fontWeight: FontWeight.semiBold },
  progressContainer: { width: '100%', marginBottom: Spacing.md },
  progressTrack: { height: 6, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: Radius.full },
  progressPct: { fontSize: FontSize.sm, color: colors.textTertiary, textAlign: 'center' },
  allowedAppsButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, backgroundColor: colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  allowedAppsButtonText: { flex: 1, color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  hint: { fontSize: FontSize.xs, color: colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },
  motivationStrip: { position: 'absolute', bottom: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6 },
  motivationText: { fontSize: FontSize.xs, color: colors.primary, fontWeight: FontWeight.medium, letterSpacing: 0.5 },
  exitOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  exitCard: { backgroundColor: colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.danger + '44', padding: Spacing.xl, alignItems: 'center', width: '100%' },
  exitTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textPrimary, marginVertical: Spacing.sm, includeFontPadding: false },
  exitSub: { fontSize: FontSize.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg },
  exitConfirm: { width: '100%', backgroundColor: colors.danger, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm },
  exitConfirmText: { color: colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  exitCancel: { width: '100%', backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  exitCancelText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
