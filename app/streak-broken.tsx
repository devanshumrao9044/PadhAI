import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { STREAK_RECOVERY_MINUTES } from '@/services/streakRecovery';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { STREAK_BROKEN_MESSAGES } from '@/constants/messages';
import { useApp } from '@/hooks/useApp';

const RECOVERY_MINS = STREAK_RECOVERY_MINUTES;

export default function StreakBrokenScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ lost?: string }>();
  const { user, startSession, setStreakRecoveryPending } = useApp();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const challengeSlide = useRef(new Animated.Value(40)).current;
  const challengeOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [starting, setStarting] = useState(false);

  // FIX: Read lost streak from params first. Agar params nahi hai, tab fallback to current streak.
  // Isse kabhi bhi 'streakLongest' galti se lost streak ki jagah nahi dikhega.
  const passedLost = params.lost ? parseInt(params.lost, 10) : 0;
  const displayLost = passedLost > 0 ? passedLost : (user?.streakCurrent ?? 0);

  const message =
    STREAK_BROKEN_MESSAGES[Math.floor(Math.random() * STREAK_BROKEN_MESSAGES.length)];

  // Animation refs are stable and this recovery entrance intentionally runs once.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start();

    // Challenge card slides in after the hero section fades
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(challengeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(challengeSlide, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      ]).start();
    }, 600);

    // Pulse on the CTA button
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    const pulseTimeout = setTimeout(() => pulse.start(), 1200);

    return () => {
      pulse.stop();
      clearTimeout(pulseTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartChallenge = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Record that this session is a streak-recovery attempt with how much was lost
      setStreakRecoveryPending(true, displayLost);
      await startSession(RECOVERY_MINS, null, null, true, displayLost);
      router.replace('/focus/active');
    } catch {
      setStreakRecoveryPending(false, 0);
      setStarting(false);
    }
  };

  const halfRecovered = Math.max(1, Math.ceil(displayLost / 2));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>

        {/* ── Hero: big zero ── */}
        <Animated.View
          style={[styles.iconSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.iconBg}>
            <Text style={styles.zeroText}>0</Text>
          </View>
          <Text style={styles.dayLabel}>{t('home.streak')}</Text>
        </Animated.View>

        {/* ── Text block ── */}
        <Animated.View style={[styles.textSection, { opacity: fadeAnim }]}>
          <Text style={styles.title}>{t('recovery.title')}</Text>
          <Text style={styles.subtitle}>{message}</Text>

          {displayLost > 0 ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="local-fire-department" size={18} color={colors.danger} />
                  <Text style={styles.infoText}>{t('recovery.lostStreak', { value: displayLost })}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="emoji-events" size={18} color={colors.warning} />
                <Text style={styles.infoText}>
                  {t('recovery.best', { value: user?.streakLongest ?? 0 })}
                </Text>
              </View>
            </View>
          ) : null}
        </Animated.View>

        {/* ── Challenge Card ── */}
        <Animated.View
          style={[
            styles.challengeCard,
            {
              opacity: challengeOpacity,
              transform: [{ translateY: challengeSlide }],
            },
          ]}
        >
          <View style={styles.challengeHeader}>
            <View style={styles.challengeIconBg}>
              <Text style={styles.challengeEmoji}>⚡</Text>
            </View>
            <View style={styles.challengeHeaderText}>
              <Text style={styles.challengeTitle}>{t('recovery.challenge')}</Text>
              <Text style={styles.challengeSub}>{t('recovery.challengeSub')}</Text>
            </View>
          </View>

          <View style={styles.recoveryRow}>
            <View style={styles.recoveryItem}>
              <Text style={styles.recoveryNum}>0</Text>
              <Text style={styles.recoveryLabel}>{t('recovery.current')}</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={colors.textTertiary} />
            <View style={styles.recoveryItem}>
              <Text style={[styles.recoveryNum, { color: colors.success }]}>
                {halfRecovered}
              </Text>
              <Text style={styles.recoveryLabel}>{t('recovery.restored')}</Text>
            </View>
            <MaterialIcons name="info-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.recoveryNote}>{t('recovery.halfBack')}</Text>
          </View>

          <View style={styles.rulePillRow}>
            <View style={styles.rulePill}>
              <MaterialIcons name="timer" size={13} color={colors.primary} />
              <Text style={styles.rulePillText}>{t('recovery.fullThirty')}</Text>
            </View>
            <View style={styles.rulePill}>
              <MaterialIcons name="close" size={13} color={colors.danger} />
              <Text style={styles.rulePillText}>{t('recovery.noBreak')}</Text>
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.challengeBtn, starting && styles.challengeBtnDisabled]}
              onPress={handleStartChallenge}
              disabled={starting}
              activeOpacity={0.88}
            >
              <MaterialIcons name="bolt" size={20} color={colors.background} />
              <Text style={styles.challengeBtnText}>
                {starting ? t('recovery.starting') : t('recovery.start', { value: RECOVERY_MINS })}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* ── Skip ── */}
        <Animated.View style={[styles.skipSection, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={styles.homeBtnText}>{t('recovery.later')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg, paddingBottom: Spacing.xxl,
  },

  // Hero
  iconSection: { alignItems: 'center', marginBottom: Spacing.lg },
  iconBg: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.danger + '15',
    borderWidth: 2, borderColor: colors.danger + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  zeroText: {
    fontSize: 68, fontWeight: FontWeight.extraBold,
    color: colors.danger, includeFontPadding: false, lineHeight: 70,
  },
  dayLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: colors.danger, letterSpacing: 3, marginTop: 8, textTransform: 'uppercase',
  },

  // Text
  textSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold,
    color: colors.textPrimary, textAlign: 'center',
    includeFontPadding: false, marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.base, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 24, marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  infoCard: {
    width: '100%', backgroundColor: colors.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, gap: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: FontSize.sm, color: colors.textSecondary },
  infoBold: { color: colors.textPrimary, fontWeight: FontWeight.semiBold },

  // Challenge card
  challengeCard: {
    width: '100%', backgroundColor: colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: colors.warning + '66',
    padding: Spacing.md, marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  challengeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  challengeIconBg: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.warningDim,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.warning + '66',
  },
  challengeEmoji: { fontSize: 22 },
  challengeHeaderText: { flex: 1 },
  challengeTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extraBold,
    color: colors.warning, letterSpacing: 1.5, textTransform: 'uppercase',
  },
  challengeSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Recovery numbers
  recoveryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceVariant, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  recoveryItem: { alignItems: 'center', minWidth: 44 },
  recoveryNum: {
    fontSize: FontSize.xl, fontWeight: FontWeight.extraBold,
    color: colors.textPrimary, includeFontPadding: false,
  },
  recoveryLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  recoveryNote: { fontSize: FontSize.xs, color: colors.textTertiary, flex: 1 },

  // Rule pills
  rulePillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rulePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surfaceVariant, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  rulePillText: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium },

  // CTA
  challengeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.warning, borderRadius: Radius.md, paddingVertical: 15,
  },
  challengeBtnDisabled: { opacity: 0.55 },
  challengeBtnText: {
    color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.extraBold,
    letterSpacing: 0.5,
  },

  // Skip
  skipSection: { width: '100%', marginTop: 4 },
  homeBtn: {
    backgroundColor: colors.surface, borderRadius: Radius.md,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  homeBtnText: { color: colors.textTertiary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});

