import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { LEVELS } from '@/constants/levels';

const { width: SCREEN_W } = Dimensions.get('window');

// Particle for fireworks
function Particle({ color, delay, x, y }: { color: string; delay: number; x: number; y: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, tension: 80, friction: 5, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: y, duration: 1400, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: x, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

const PARTICLE_COLORS = ['#FFD700', '#A855F7', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#FBBF24', '#34D399'];
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  delay: (i * 80) % 1200,
  x: Math.cos((i / 24) * Math.PI * 2) * (60 + (i % 3) * 30),
  y: Math.sin((i / 24) * Math.PI * 2) * (60 + (i % 3) * 30),
}));

export default function LevelUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    newLevel: string;
    title: string;
    examTitle: string;
    color: string;
    totalXP: string;
    xpEarned: string;
  }>();

  const newLevelRank = parseInt(params.newLevel ?? '1', 10);
  const totalXP = parseInt(params.totalXP ?? '0', 10);
  const xpEarned = parseInt(params.xpEarned ?? '0', 10);
  const levelDef = LEVELS.find(l => l.rank === newLevelRank) ?? LEVELS[0];
  const prevLevel = LEVELS.find(l => l.rank === newLevelRank - 1);

  // Animation refs
  const bgFlash = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(30)).current;
  const btnFade = useRef(new Animated.Value(0)).current;
  const beamRotate = useRef(new Animated.Value(0)).current;
  const rankBadgeScale = useRef(new Animated.Value(0.6)).current;
  const rankBadgeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Flash → badge slam in → text slide up → button fade
    Animated.sequence([
      Animated.timing(bgFlash, { toValue: 1, duration: 180, useNativeDriver: false }),
      Animated.timing(bgFlash, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.spring(badgeScale, { toValue: 1.15, tension: 60, friction: 5, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(rankBadgeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(rankBadgeScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(textSlide, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();
    }, 400);

    setTimeout(() => {
      Animated.timing(btnFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 800);

    // Continuous beam rotation
    Animated.loop(
      Animated.timing(beamRotate, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();

    // Badge breathe pulse
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(badgePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }, 700);
  }, []);

  const spin = beamRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bgColor = bgFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.background, levelDef.color + '22'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Particle burst */}
        <View style={styles.particleOrigin} pointerEvents="none">
          {PARTICLES.map(p => (
            <Particle key={p.id} color={p.color} delay={p.delay} x={p.x} y={p.y} />
          ))}
        </View>

        {/* Rotating beams */}
        <Animated.View
          style={[styles.beamContainer, { transform: [{ rotate: spin }] }]}
          pointerEvents="none"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.beam,
                {
                  transform: [{ rotate: `${(i / 8) * 360}deg` }, { translateY: -SCREEN_W * 0.5 }],
                  backgroundColor: levelDef.color + '18',
                },
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.content}>
          {/* Previous → New level path */}
          {prevLevel ? (
            <View style={styles.levelPath}>
              <View style={[styles.prevLevelDot, { backgroundColor: prevLevel.color + '55' }]}>
                <Text style={[styles.prevLevelText, { color: prevLevel.color }]}>{prevLevel.realisticTitle}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={16} color={Colors.textTertiary} />
              <View style={[styles.newLevelDot, { backgroundColor: levelDef.color + '33', borderColor: levelDef.color }]}>
                <Text style={[styles.newLevelText, { color: levelDef.color }]}>{levelDef.realisticTitle}</Text>
              </View>
            </View>
          ) : null}

          {/* Big badge */}
          <Animated.View
            style={[
              styles.badgeWrapper,
              { transform: [{ scale: Animated.multiply(badgeScale, badgePulse) }] },
            ]}
          >
            {/* Glow ring */}
            <Animated.View
              style={[
                styles.glowRing,
                { borderColor: levelDef.color, shadowColor: levelDef.color },
              ]}
            />
            {/* Badge body */}
            <View style={[styles.badge, { backgroundColor: levelDef.color + '22', borderColor: levelDef.color }]}>
              <Text style={styles.badgeLevelNum}>{newLevelRank}</Text>
              <MaterialIcons name="star" size={18} color={levelDef.color} style={{ marginTop: -4 }} />
            </View>
          </Animated.View>

          {/* Level rank badge (like the reference images) */}
          <Animated.View
            style={[
              styles.rankBadge,
              { opacity: rankBadgeOpacity, transform: [{ scale: rankBadgeScale }] },
            ]}
          >
            <View style={[styles.rankBadgeInner, { backgroundColor: levelDef.color }]}>
              <Text style={styles.rankBadgeText}>LEVEL {newLevelRank}</Text>
            </View>
          </Animated.View>

          {/* Text block */}
          <Animated.View
            style={[
              styles.textBlock,
              { opacity: textFade, transform: [{ translateY: textSlide }] },
            ]}
          >
            <Text style={styles.levelUpLabel}>LEVEL UP!</Text>
            <Text style={[styles.levelTitle, { color: levelDef.color }]}>{levelDef.realisticTitle}</Text>
            <Text style={styles.examTitle}>{levelDef.examTitle}</Text>
            <Text style={styles.subtitle}>
              Tune abhi ek naya milestone cross kiya hai.{'\n'}Yahi asli mehnat hai!
            </Text>

            {/* XP earned this session */}
            <View style={styles.xpRow}>
              <View style={styles.xpChip}>
                <MaterialIcons name="bolt" size={18} color={Colors.warning} />
                <Text style={styles.xpChipText}>+{xpEarned} XP earned</Text>
              </View>
              <View style={[styles.xpChip, { backgroundColor: levelDef.color + '22', borderColor: levelDef.color + '55' }]}>
                <MaterialIcons name="emoji-events" size={18} color={levelDef.color} />
                <Text style={[styles.xpChipText, { color: levelDef.color }]}>{totalXP} XP total</Text>
              </View>
            </View>
          </Animated.View>

          {/* CTA */}
          <Animated.View style={[styles.btnBlock, { opacity: btnFade }]}>
            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: levelDef.color }]}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.85}
            >
              <MaterialIcons name="rocket-launch" size={22} color="#FFF" />
              <Text style={styles.continueBtnText}>Continue the Grind</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  particleOrigin: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    width: 0,
    height: 0,
    zIndex: 20,
  },
  beamContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beam: {
    position: 'absolute',
    width: 40,
    height: SCREEN_W * 1.2,
    borderRadius: 20,
    transformOrigin: 'center bottom',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    zIndex: 10,
  },

  levelPath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  prevLevelDot: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  prevLevelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  newLevelDot: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  newLevelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  badgeWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 16,
  },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  badgeLevelNum: {
    fontSize: 56,
    fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary,
    includeFontPadding: false,
    lineHeight: 60,
  },

  rankBadge: {
    marginBottom: Spacing.xl,
  },
  rankBadgeInner: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  rankBadgeText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extraBold,
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  textBlock: {
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.xl,
  },
  levelUpLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold,
    color: Colors.warning,
    letterSpacing: 3,
    marginBottom: 4,
  },
  levelTitle: {
    fontSize: 36,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
    marginBottom: 4,
  },
  examTitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  xpRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
  },
  xpChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.warning,
  },

  btnBlock: { width: '100%' },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: Radius.lg,
    paddingVertical: 18,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold,
    letterSpacing: 0.5,
  },
});
