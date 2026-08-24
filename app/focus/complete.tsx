
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getLevelForUser } from '@/constants/levels';
import { COMPLETION_MESSAGES } from '@/constants/messages';
import { subscribeToOfflineFocusReconnect, syncOfflineFocusQueue } from '@/features/focus/services/offlineFocusSync';

function ConfettiDot({
  color, delay, startX,
}: {
  color: string; delay: number; startX: number;
}) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Confetti inputs are fixed for the particle lifetime; this loop intentionally starts once.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 280, duration: 1600, useNativeDriver: true }),
          Animated.timing(translateX, {
            toValue: startX + (Math.random() * 60 - 30),
            duration: 1600, useNativeDriver: true,
          }),
          Animated.timing(rotate, { toValue: 1, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [delay, opacity, rotate, startX, translateX, translateY]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 2,
        backgroundColor: color, opacity,
        transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
    />
  );
}

const CONFETTI_COLORS = [
  '#F59E0B', '#A855F7', '#10B981', '#3B82F6',
  '#EF4444', '#EC4899', '#FBBF24',
];

export default function FocusCompleteScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{
    xp: string; referralXp: string; comeback: string; recovery: string; lostStreak: string; pending: string; clock: string; rejected: string;
  }>();
  const { user, reload } = useApp();

  const xp = parseInt(params.xp ?? '0', 10);
  const referralXpAwarded = parseInt(params.referralXp ?? '0', 10);
  const isComeback = params.comeback === '1';
  const isRecovery = params.recovery === '1';
  const lostStreak = parseInt(params.lostStreak ?? '0', 10);
  const isPending = params.pending === '1';
  const isRejected = params.rejected === '1';
  const clockAnomaly = params.clock === '1';
  const [syncedXP, setSyncedXP] = useState<number | null>(null);
  const recoveredStreak = Math.max(1, Math.ceil(lostStreak / 2));
  const COMEBACK_BONUS = 50;

  // Animated values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const comebackSlide = useRef(new Animated.Value(-60)).current;
  const comebackOpacity = useRef(new Animated.Value(0)).current;
  const comebackScale = useRef(new Animated.Value(0.7)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const recoverySlide = useRef(new Animated.Value(-50)).current;
  const recoveryOpacity = useRef(new Animated.Value(0)).current;
  const recoveryScale = useRef(new Animated.Value(0.85)).current;

  const messageRef = useRef(
    COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]
  );
  const level = user ? getLevelForUser(user) : null;
  const resolvedPending = !isRejected && isPending && syncedXP === null;
  const displayedXP = syncedXP ?? xp;

  useEffect(() => {
    if (!isPending || !user?.id) return;
    let mounted = true;
    const applyResults = (results: Awaited<ReturnType<typeof syncOfflineFocusQueue>>) => {
      const accepted = results.find(result => result.status === 'accepted' || result.status === 'duplicate');
      if (mounted && accepted) {
        setSyncedXP(accepted.xpEarned ?? 0);
        void reload({ force: true });
      }
    };
    void syncOfflineFocusQueue(user.id).then(applyResults);
    const unsubscribe = subscribeToOfflineFocusReconnect(user.id, applyResults);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [isPending, reload, user?.id]);

  // AppContext applies streak recovery only after the full recovery session passes
  // the 30-minute policy. This screen only renders the confirmed result.

  // AppContext already applies the server-returned total, including any referral
  // bonus. Do not add referral XP again on the completion screen.

  // Animation refs are stable and route params are immutable for this mounted screen.
  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 50, friction: 6, useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    let comebackTimeout: ReturnType<typeof setTimeout> | null = null;
    let recoveryTimeout: ReturnType<typeof setTimeout> | null = null;
    let shimmerLoop: ReturnType<typeof Animated.loop> | null = null;

    if (isComeback) {
      shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      );
      comebackTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.spring(comebackSlide, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
          Animated.timing(comebackOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.spring(comebackScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
        shimmerLoop?.start();
      }, 600);
    }

    // Recovery badge animation (always shown if isRecovery)
    if (isRecovery) {
      recoveryTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.spring(recoverySlide, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
          Animated.timing(recoveryOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(recoveryScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
      }, isComeback ? 1000 : 700);
    }

    return () => {
      if (comebackTimeout) clearTimeout(comebackTimeout);
      if (recoveryTimeout) clearTimeout(recoveryTimeout);
      glowLoop.stop();
      shimmerLoop?.stop();
      scaleAnim.stopAnimation();
      fadeAnim.stopAnimation();
      glowAnim.stopAnimation();
      comebackSlide.stopAnimation();
      comebackOpacity.stopAnimation();
      comebackScale.stopAnimation();
      shimmerAnim.stopAnimation();
      recoverySlide.stopAnimation();
      recoveryOpacity.stopAnimation();
      recoveryScale.stopAnimation();
    };
  }, [comebackOpacity, comebackScale, comebackSlide, fadeAnim, glowAnim, isComeback, isRecovery, recoveryOpacity, recoveryScale, recoverySlide, scaleAnim, shimmerAnim]);

  const showConfetti = !resolvedPending && !isRejected && (isComeback || isRecovery);
  const confettiParticles = showConfetti
    ? Array.from({ length: 18 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: (i * 120) % 900,
        startX: (i * 23) % 320 - 40,
      }))
    : [];

  const screenTitle = isRejected
    ? t('focus.syncRejectedTitle')
    : resolvedPending
    ? t('focus.syncPendingTitle')
    : isRecovery
    ? t('focus.recovery')
    : isComeback
    ? t('focus.comeback')
    : t('focus.sessionComplete');

  const screenMessage = isRejected
    ? t('focus.syncRejectedMessage')
    : resolvedPending
    ? (clockAnomaly ? t('focus.syncPendingClockMessage') : t('focus.syncPendingMessage'))
    : isRecovery
    ? t('focus.recoveryDetail', { lost: lostStreak, recovered: recoveredStreak })
    : isComeback
    ? t('focus.comebackDescription')
    : messageRef.current;

  const heroIcon = isRejected ? 'error-outline' : resolvedPending ? 'cloud-upload' : isRecovery ? 'local-fire-department' : isComeback ? 'whatshot' : 'emoji-events';
  const heroColor = isRejected ? colors.danger : resolvedPending ? colors.primary : isRecovery ? colors.success : isComeback ? '#F97316' : colors.warning;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {showConfetti && (
        <View style={styles.confettiLayer} pointerEvents="none">
          {confettiParticles.map(p => (
            <ConfettiDot key={p.id} color={p.color} delay={p.delay} startX={p.startX} />
          ))}
        </View>
      )}

      <View style={styles.content}>
        <Animated.View style={[styles.trophyContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View
            style={[
              styles.trophyGlow,
              (isComeback || isRecovery) && styles.trophyGlowComeback,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, (isComeback || isRecovery) ? 1 : 0.8],
                }),
                backgroundColor: heroColor + (isRecovery ? '44' : '33'),
              },
            ]}
          />
          <MaterialIcons name={heroIcon} size={96} color={heroColor} />
        </Animated.View>

        <Animated.View style={[styles.textSection, { opacity: fadeAnim }]}>
          <Text style={[
            styles.completeTitle,
            (isComeback || isRecovery) && { color: heroColor, fontSize: 28 },
          ]}>
            {screenTitle}
          </Text>
          <Text style={styles.message}>{screenMessage}</Text>

          {isRejected ? (
            <View style={[styles.xpCard, { backgroundColor: heroColor + '18', borderColor: heroColor + '55' }]}>
              <MaterialIcons name="error-outline" size={28} color={heroColor} />
              <Text style={[styles.xpAmount, { color: heroColor }]}>{t('focus.syncRejectedNoXP')}</Text>
              <Text style={styles.xpLabel}>{t('focus.syncRejectedMessage')}</Text>
            </View>
          ) : resolvedPending ? (
            <View style={[styles.xpCard, { backgroundColor: heroColor + '22', borderColor: heroColor + '55' }]}>
              <MaterialIcons name="cloud-upload" size={28} color={heroColor} />
              <Text style={[styles.xpAmount, { color: heroColor }]}>{t('focus.syncPendingTitle')}</Text>
              <Text style={styles.xpLabel}>{t('focus.syncPendingMessage')}</Text>
            </View>
          ) : (
          <View style={[styles.xpCard, (isComeback || isRecovery) && { backgroundColor: heroColor + '22', borderColor: heroColor + '55' }]}>
            <MaterialIcons name="bolt" size={28} color={colors.warning} />
            <Text style={styles.xpAmount}>+{displayedXP} XP</Text>
            <Text style={styles.xpLabel}>{t('focus.earned')}</Text>
          </View>
          )}

          {!isPending && referralXpAwarded > 0 ? (
            <View style={styles.referralBonusBanner}>
              <View style={styles.referralBonusIcon}><MaterialIcons name="people" size={22} color={colors.success} /></View>
              <View style={styles.referralBonusText}>
                <Text style={styles.referralBonusTitle}>{t('focus.referralBonus')}</Text>
                <Text style={styles.referralBonusSub}>{t('focus.referralDescription')}</Text>
              </View>
              <View style={styles.referralBonusBadge}>
                <Text style={styles.referralBonusAmount}>+{referralXpAwarded}</Text>
                <Text style={styles.referralBonusLabel}>XP</Text>
              </View>
            </View>
          ) : null}

          {/* ── Streak Recovery Badge ── */}
          {isRecovery ? (
            <Animated.View
              style={[
                styles.recoveryBanner,
                {
                  opacity: recoveryOpacity,
                  transform: [{ translateY: recoverySlide }, { scale: recoveryScale }],
                },
              ]}
            >
              <View style={styles.recoveryBannerInner}>
                <Text style={styles.recoveryEmoji}>🔥</Text>
                <View style={styles.recoveryTextBlock}>
                  <Text style={styles.recoveryTitle}>{t('focus.streakRecovered')}</Text>
                  <Text style={styles.recoverySub}>{t('focus.recoveryDetail', { lost: lostStreak, recovered: recoveredStreak })}</Text>
                </View>
                <View style={styles.recoveryStreakBadge}>
                  <Text style={styles.recoveryStreakNum}>{recoveredStreak}</Text>
                  <Text style={styles.recoveryStreakLabel}>{t('focus.days')}</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* ── Comeback Banner (existing, shown when isComeback without recovery) ── */}
          {isComeback && !isRecovery ? (
            <Animated.View
              style={[
                styles.comebackBanner,
                {
                  opacity: comebackOpacity,
                  transform: [{ translateY: comebackSlide }, { scale: comebackScale }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.comebackShimmer,
                  {
                    opacity: shimmerAnim.interpolate({
                      inputRange: [0, 1], outputRange: [0, 0.25],
                    }),
                  },
                ]}
              />
              <View style={styles.comebackBannerInner}>
                <Text style={styles.comebackEmoji}>🔥</Text>
                <View style={styles.comebackTextBlock}>
                <Text style={styles.comebackTitle}>{t('focus.comebackBonus')}</Text>
                <Text style={styles.comebackSub}>{t('focus.comebackDescription')}</Text>
                </View>
                <View style={styles.comebackXPBadge}>
                  <Text style={styles.comebackXP}>+{COMEBACK_BONUS}</Text>
                  <Text style={styles.comebackXPLabel}>XP</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {level ? (
            <View style={styles.levelRow}>
              <Text style={[styles.levelName, { color: level.color }]}>
                {level.realisticTitle}
              </Text>
              <Text style={styles.levelTotal}>{user?.xpTotal ?? 0} Weekly XP</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              isRecovery && { backgroundColor: colors.success },
              !isRecovery && isComeback && styles.continueBtnComeback,
            ]}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
                {isRecovery || isComeback ? t('focus.goHomeHero') : t('focus.returnHome')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.anotherBtn}
            onPress={() => router.replace('/(tabs)/focus')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="replay" size={18} color={colors.primary} />
            <Text style={styles.anotherBtnText}>One More Session</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  confettiLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10, overflow: 'hidden',
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  trophyContainer: {
    width: 160, height: 160, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xl,
  },
  trophyGlow: {
    position: 'absolute', width: 160, height: 160,
    borderRadius: 80, backgroundColor: colors.warning + '33',
  },
  trophyGlowComeback: { width: 180, height: 180, borderRadius: 90 },
  textSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.xl },
  completeTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold,
    color: colors.textPrimary, textAlign: 'center',
    includeFontPadding: false, marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.md, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 26, marginBottom: Spacing.lg,
  },
  xpCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.warning + '22', borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: colors.warning + '44', marginBottom: Spacing.sm,
  },
  xpAmount: {
    fontSize: 40, fontWeight: FontWeight.extraBold,
    color: colors.warning, includeFontPadding: false,
  },
  xpLabel: { fontSize: FontSize.base, color: colors.warning + 'AA' },
  referralBonusBanner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: colors.success + '66', backgroundColor: colors.success + '18', padding: Spacing.md, marginBottom: Spacing.md },
  referralBonusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success + '22' },
  referralBonusText: { flex: 1 },
  referralBonusTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.extraBold, color: colors.success, letterSpacing: 1.2, marginBottom: 2 },
  referralBonusSub: { fontSize: FontSize.xs, color: colors.textSecondary, lineHeight: 17 },
  referralBonusBadge: { minWidth: 54, alignItems: 'center', borderRadius: Radius.md, backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 6 },
  referralBonusAmount: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.extraBold },
  referralBonusLabel: { color: '#FFFFFFCC', fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.8 },

  // ── Streak Recovery Banner ──
  recoveryBanner: {
    width: '100%', borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1.5,
    borderColor: colors.success + '66', backgroundColor: colors.success + '18',
  },
  recoveryBannerInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm,
  },
  recoveryEmoji: { fontSize: 30 },
  recoveryTextBlock: { flex: 1 },
  recoveryTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extraBold,
    color: colors.success, letterSpacing: 1.5, marginBottom: 2, textTransform: 'uppercase',
  },
  recoverySub: { fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 18 },
  recoveryStreakBadge: {
    alignItems: 'center', backgroundColor: colors.success,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6, minWidth: 52,
  },
  recoveryStreakNum: {
    fontSize: FontSize.lg, fontWeight: FontWeight.extraBold,
    color: '#FFFFFF', includeFontPadding: false,
  },
  recoveryStreakLabel: {
    fontSize: 10, fontWeight: FontWeight.semiBold,
    color: '#FFFFFFCC', letterSpacing: 1, textTransform: 'uppercase',
  },

  // ── Comeback Banner ──
  comebackBanner: {
    width: '100%', borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1.5,
    borderColor: '#F97316' + '66', backgroundColor: '#F97316' + '18',
  },
  comebackShimmer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF', zIndex: 1,
  },
  comebackBannerInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm, zIndex: 2,
  },
  comebackEmoji: { fontSize: 32 },
  comebackTextBlock: { flex: 1 },
  comebackTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extraBold,
    color: '#F97316', letterSpacing: 1.5, marginBottom: 2, textTransform: 'uppercase',
  },
  comebackSub: { fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 18 },
  comebackXPBadge: {
    alignItems: 'center', backgroundColor: '#F97316',
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6, minWidth: 56,
  },
  comebackXP: {
    fontSize: FontSize.lg, fontWeight: FontWeight.extraBold,
    color: '#FFFFFF', includeFontPadding: false,
  },
  comebackXPLabel: {
    fontSize: 10, fontWeight: FontWeight.semiBold,
    color: '#FFFFFF' + 'CC', letterSpacing: 1, textTransform: 'uppercase',
  },

  levelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  levelName: { fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
  levelTotal: { fontSize: FontSize.sm, color: colors.textTertiary },
  actions: { width: '100%', gap: 10 },
  continueBtn: {
    backgroundColor: colors.primary, borderRadius: Radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  continueBtnComeback: { backgroundColor: '#F97316' },
  continueBtnText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  anotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.surface, borderRadius: Radius.md,
    paddingVertical: 14, borderWidth: 1, borderColor: colors.primary + '55',
  },
  anotherBtnText: { color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
});
