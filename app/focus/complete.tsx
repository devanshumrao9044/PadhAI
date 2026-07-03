import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getLevelForXP } from '@/constants/levels';
import { COMPLETION_MESSAGES } from '@/constants/messages';
import { supabase } from '@/services/supabase';
import { processReferralOnFirstSession } from '@/services/referralService';

function ConfettiDot({
  color, delay, startX,
}: {
  color: string; delay: number; startX: number;
}) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

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
  }, []);

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
  const router = useRouter();
  const params = useLocalSearchParams<{
    xp: string; comeback: string; recovery: string; lostStreak: string;
  }>();
  const { user, setUser } = useApp();

  const xp = parseInt(params.xp ?? '0', 10);
  const isComeback = params.comeback === '1';
  const isRecovery = params.recovery === '1';
  const lostStreak = parseInt(params.lostStreak ?? '0', 10);
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
  const level = user ? getLevelForXP(user.xpTotal) : null;

  // ✅ Restore half-streak when this is a recovery session
  useEffect(() => {
    if (!isRecovery || !user || lostStreak <= 0) return;
    setUser({ ...user, streakCurrent: recoveredStreak });
  }, []);

  // Referral check
  useEffect(() => {
    async function triggerReferralCheck() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) await processReferralOnFirstSession(authUser.id);
      } catch (err) {
        console.log('Referral hook error:', err);
      }
    }
    triggerReferralCheck();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 50, friction: 6, useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    if (isComeback) {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(comebackSlide, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
          Animated.timing(comebackOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.spring(comebackScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();

        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
          ])
        ).start();
      }, 600);
    }

    // Recovery badge animation (always shown if isRecovery)
    if (isRecovery) {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(recoverySlide, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
          Animated.timing(recoveryOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(recoveryScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
      }, isComeback ? 1000 : 700);
    }
  }, []);

  const showConfetti = isComeback || isRecovery;
  const confettiParticles = showConfetti
    ? Array.from({ length: 18 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: (i * 120) % 900,
        startX: (i * 23) % 320 - 40,
      }))
    : [];

  const screenTitle = isRecovery
    ? 'Wapas Aa Gaye!'
    : isComeback
    ? 'Wapas Aa Gaye!'
    : 'Session Complete!';

  const screenMessage = isRecovery
    ? `${recoveredStreak} din ki streak recover ho gayi!\nZiddi student waisa hi karta hai.`
    : isComeback
    ? 'Streak toot gayi thi — par aaj tune wapas shuruat ki.\nYahi asli ziddi student hota hai.'
    : messageRef.current;

  const heroIcon = isRecovery ? 'local-fire-department' : isComeback ? 'whatshot' : 'emoji-events';
  const heroColor = isRecovery ? Colors.success : isComeback ? '#F97316' : Colors.warning;

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

          <View style={[styles.xpCard, (isComeback || isRecovery) && { backgroundColor: heroColor + '22', borderColor: heroColor + '55' }]}>
            <MaterialIcons name="bolt" size={28} color={Colors.warning} />
            <Text style={styles.xpAmount}>+{xp} XP</Text>
            <Text style={styles.xpLabel}>earned</Text>
          </View>

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
                  <Text style={styles.recoveryTitle}>STREAK RECOVERED</Text>
                  <Text style={styles.recoverySub}>
                    {lostStreak} din gayi thi — {recoveredStreak} din wapas mili
                  </Text>
                </View>
                <View style={styles.recoveryStreakBadge}>
                  <Text style={styles.recoveryStreakNum}>{recoveredStreak}</Text>
                  <Text style={styles.recoveryStreakLabel}>days</Text>
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
                  <Text style={styles.comebackTitle}>COMEBACK BONUS</Text>
                  <Text style={styles.comebackSub}>Came back after breaking the streak </Text>
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
              <Text style={styles.levelTotal}>{user?.xpTotal ?? 0} XP total</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              isRecovery && { backgroundColor: Colors.success },
              !isRecovery && isComeback && styles.continueBtnComeback,
            ]}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {isRecovery ? 'Ghar Chalo — Hero ' : isComeback ? 'Ghar Chalo — Hero ' : 'Return Home '}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.anotherBtn}
            onPress={() => router.replace('/(tabs)/focus')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="replay" size={18} color={Colors.primary} />
            <Text style={styles.anotherBtnText}>One More Session</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
    borderRadius: 80, backgroundColor: Colors.warning + '33',
  },
  trophyGlowComeback: { width: 180, height: 180, borderRadius: 90 },
  textSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.xl },
  completeTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary, textAlign: 'center',
    includeFontPadding: false, marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.md, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 26, marginBottom: Spacing.lg,
  },
  xpCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning + '22', borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.warning + '44', marginBottom: Spacing.sm,
  },
  xpAmount: {
    fontSize: 40, fontWeight: FontWeight.extraBold,
    color: Colors.warning, includeFontPadding: false,
  },
  xpLabel: { fontSize: FontSize.base, color: Colors.warning + 'AA' },

  // ── Streak Recovery Banner ──
  recoveryBanner: {
    width: '100%', borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1.5,
    borderColor: Colors.success + '66', backgroundColor: Colors.success + '18',
  },
  recoveryBannerInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm,
  },
  recoveryEmoji: { fontSize: 30 },
  recoveryTextBlock: { flex: 1 },
  recoveryTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extraBold,
    color: Colors.success, letterSpacing: 1.5, marginBottom: 2, textTransform: 'uppercase',
  },
  recoverySub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  recoveryStreakBadge: {
    alignItems: 'center', backgroundColor: Colors.success,
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
  comebackSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
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
  levelTotal: { fontSize: FontSize.sm, color: Colors.textTertiary },
  actions: { width: '100%', gap: 10 },
  continueBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  continueBtnComeback: { backgroundColor: '#F97316' },
  continueBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  anotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.primary + '55',
  },
  anotherBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
});
