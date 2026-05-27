import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getLevelForXP } from '@/constants/levels';
import { COMPLETION_MESSAGES } from '@/constants/messages';

export default function FocusCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ xp: string }>();
  const { user } = useApp();
  const xp = parseInt(params.xp ?? '0');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const message = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
  const level = user ? getLevelForXP(user.xpTotal) : null;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>

        {/* Trophy animation */}
        <Animated.View style={[styles.trophyContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={[styles.trophyGlow, {
            opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
          }]} />
          <MaterialIcons name="emoji-events" size={96} color={Colors.warning} />
        </Animated.View>

        <Animated.View style={[styles.textSection, { opacity: fadeAnim }]}>
          <Text style={styles.completeTitle}>Session Complete!</Text>
          <Text style={styles.message}>{message}</Text>

          {/* XP gained */}
          <View style={styles.xpCard}>
            <MaterialIcons name="bolt" size={28} color={Colors.warning} />
            <Text style={styles.xpAmount}>+{xp} XP</Text>
            <Text style={styles.xpLabel}>earned</Text>
          </View>

          {/* Level info */}
          {level ? (
            <View style={styles.levelRow}>
              <Text style={[styles.levelName, { color: level.color }]}>{level.realisticTitle}</Text>
              <Text style={styles.levelTotal}>{user?.xpTotal ?? 0} XP total</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Ghar Wapas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.anotherBtn}
            onPress={() => router.replace('/(tabs)/focus')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="replay" size={18} color={Colors.primary} />
            <Text style={styles.anotherBtnText}>Ek Aur Session</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl,
  },
  trophyContainer: {
    width: 160, height: 160, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  trophyGlow: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.warning + '33',
  },
  textSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.xl },
  completeTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false,
    marginBottom: Spacing.sm,
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
  levelRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4,
  },
  levelName: { fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
  levelTotal: { fontSize: FontSize.sm, color: Colors.textTertiary },
  actions: { width: '100%', gap: 10 },
  continueBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  continueBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  anotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.primary + '55',
  },
  anotherBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
});
