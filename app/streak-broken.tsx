import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { STREAK_BROKEN_MESSAGES } from '@/constants/messages';
import { useApp } from '@/hooks/useApp';

export default function StreakBrokenScreen() {
  const router = useRouter();
  const { user } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const message = STREAK_BROKEN_MESSAGES[Math.floor(Math.random() * STREAK_BROKEN_MESSAGES.length)];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>

        <Animated.View style={[styles.iconSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconBg}>
            <Text style={styles.zeroText}>0</Text>
          </View>
          <Text style={styles.dayLabel}>DAY</Text>
        </Animated.View>

        <Animated.View style={[styles.textSection, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Streak Toot Gayi</Text>
          <Text style={styles.subtitle}>{message}</Text>

          {user ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="local-fire-department" size={18} color={Colors.textTertiary} />
                <Text style={styles.infoText}>Best streak was: <Text style={styles.infoBold}>{user.streakLongest} days</Text></Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.infoText}>Aaj se naya chapter. <Text style={styles.infoBold}>Fresh start.</Text></Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.motivate}>
            Sabse bade log wahi hain jo gir ke uthte hain.{'\n'}
            Aaj Day 1 hai — isko seriously le.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => { router.replace('/(tabs)/focus'); }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="play-arrow" size={22} color={Colors.background} />
            <Text style={styles.startBtnText}>Abhi Shuru Karo — Day 1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.homeBtnText}>Home Jao</Text>
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
    padding: Spacing.xl,
  },
  iconSection: { alignItems: 'center', marginBottom: Spacing.xl },
  iconBg: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.danger + '15',
    borderWidth: 2, borderColor: Colors.danger + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  zeroText: {
    fontSize: 80, fontWeight: FontWeight.extraBold,
    color: Colors.danger, includeFontPadding: false,
    lineHeight: 80,
  },
  dayLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semiBold,
    color: Colors.danger, letterSpacing: 4, marginTop: 8, textTransform: 'uppercase',
  },
  textSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.xl },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.lg, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 28, marginBottom: Spacing.lg,
    fontStyle: 'italic',
  },
  infoCard: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: 10, marginBottom: Spacing.lg,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: FontSize.base, color: Colors.textSecondary },
  infoBold: { color: Colors.textPrimary, fontWeight: FontWeight.semiBold },
  motivate: {
    fontSize: FontSize.base, color: Colors.textTertiary,
    textAlign: 'center', lineHeight: 24,
  },
  actions: { width: '100%', gap: 10 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16,
  },
  startBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  homeBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  homeBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
});
