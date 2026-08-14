import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { STREAK_BROKEN_MESSAGES } from '@/constants/messages';
import { useApp } from '@/hooks/useApp';

const RECOVERY_MINS = 30;

export default function StreakBrokenScreen() {
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
  }, []);

  const handleStartChallenge = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Record that this session is a streak-recovery attempt with how much was lost
      setStreakRecoveryPending(true, displayLost);
      await startSession(RECOVERY_MINS, null, null);
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
          <Text style={styles.dayLabel}>DAY STREAK</Text>
        </Animated.View>

        {/* ── Text block ── */}
        <Animated.View style={[styles.textSection, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Streak Toot Gayi</Text>
          <Text style={styles.subtitle}>{message}</Text>

          {displayLost > 0 ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="local-fire-department" size={18} color={Colors.danger} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>{displayLost} day</Text> ki streak gayi.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="emoji-events" size={18} color={Colors.warning} />
                <Text style={styles.infoText}>
                  Best: <Text style={styles.infoBold}>{user?.streakLongest ?? 0} days</Text>
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
              <Text style={styles.challengeTitle}>COMEBACK CHALLENGE</Text>
              <Text style={styles.challengeSub}>30 min session = streak wapas</Text>
            </View>
          </View>

          <View style={styles.recoveryRow}>
            <View style={styles.recoveryItem}>
              <Text style={styles.recoveryNum}>0</Text>
              <Text style={styles.recoveryLabel}>Abhi streak</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={Colors.textTertiary} />
            <View style={styles.recoveryItem}>
              <Text style={[styles.recoveryNum, { color: Colors.success }]}>
                {halfRecovered}
              </Text>
              <Text style={styles.recoveryLabel}>Recover hogi</Text>
            </View>
            <MaterialIcons name="info-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.recoveryNote}>Half back</Text>
          </View>

          <View style={styles.rulePillRow}>
            <View style={styles.rulePill}>
              <MaterialIcons name="timer" size={13} color={Colors.primary} />
              <Text style={styles.rulePillText}>30 minutes full</Text>
            </View>
            <View style={styles.rulePill}>
              <MaterialIcons name="close" size={13} color={Colors.danger} />
              <Text style={styles.rulePillText}>Break allowed nahi</Text>
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.challengeBtn, starting && styles.challengeBtnDisabled]}
              onPress={handleStartChallenge}
              disabled={starting}
              activeOpacity={0.88}
            >
              <MaterialIcons name="bolt" size={20} color={Colors.background} />
              <Text style={styles.challengeBtnText}>
                {starting ? 'Starting...' : `Abhi Shuru Karo — ${RECOVERY_MINS} Min`}
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
            <Text style={styles.homeBtnText}>Baad Mein Karunga</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg, paddingBottom: Spacing.xxl,
  },

  // Hero
  iconSection: { alignItems: 'center', marginBottom: Spacing.lg },
  iconBg: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.danger + '15',
    borderWidth: 2, borderColor: Colors.danger + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  zeroText: {
    fontSize: 68, fontWeight: FontWeight.extraBold,
    color: Colors.danger, includeFontPadding: false, lineHeight: 70,
  },
  dayLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.danger, letterSpacing: 3, marginTop: 8, textTransform: 'uppercase',
  },

  // Text
  textSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary, textAlign: 'center',
    includeFontPadding: false, marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.base, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24, marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  infoCard: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoBold: { color: Colors.textPrimary, fontWeight: FontWeight.semiBold },

  // Challenge card
  challengeCard: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: '#F97316' + '66',
    padding: Spacing.md, marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  challengeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  challengeIconBg: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F97316' + '22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F97316' + '55',
  },
  challengeEmoji: { fontSize: 22 },
  challengeHeaderText: { flex: 1 },
  challengeTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extraBold,
    color: '#F97316', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  challengeSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  // Recovery numbers
  recoveryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  recoveryItem: { alignItems: 'center', minWidth: 44 },
  recoveryNum: {
    fontSize: FontSize.xl, fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary, includeFontPadding: false,
  },
  recoveryLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  recoveryNote: { fontSize: FontSize.xs, color: Colors.textTertiary, flex: 1 },

  // Rule pills
  rulePillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rulePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surfaceVariant, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  rulePillText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  // CTA
  challengeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F97316', borderRadius: Radius.md, paddingVertical: 15,
  },
  challengeBtnDisabled: { opacity: 0.55 },
  challengeBtnText: {
    color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.extraBold,
    letterSpacing: 0.5,
  },

  // Skip
  skipSection: { width: '100%', marginTop: 4 },
  homeBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  homeBtnText: { color: Colors.textTertiary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});

