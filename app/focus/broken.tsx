import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { SESSION_BREAK_MESSAGES } from '@/constants/messages';

export default function FocusBrokenScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ penalty: string }>();

  // Safe parsing
  const penalty = parseInt(params.penalty ?? '0', 10);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.2)).current;

  // Stable random message reference
  const messageRef = useRef(SESSION_BREAK_MESSAGES[Math.floor(Math.random() * SESSION_BREAK_MESSAGES.length)]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim, fadeAnim, scaleAnim]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] }]}>
          <View style={styles.iconBg}>
            <MaterialIcons name="cancel" size={80} color={colors.danger} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.messageSection, { opacity: fadeAnim }]}>
           <Text style={styles.brokenTitle}>{t('focus.brokenTitle')}</Text>
          <Text style={styles.rudeMessage}>{messageRef.current}</Text>

          <View style={styles.consequences}>
            <View style={styles.consequenceRow}>
              <MaterialIcons name="remove-circle" size={18} color={colors.danger} />
              <Text style={styles.consequenceText}>{penalty > 0 ? t('focus.xpDeducted', { value: penalty }) : t('focus.xpPenalized')}</Text>
            </View>
            <View style={styles.consequenceRow}>
              <MaterialIcons name="remove-circle" size={18} color={colors.danger} />
              <Text style={styles.consequenceText}>{t('focus.streakReset')}</Text>
            </View>
            <View style={styles.consequenceRow}>
              <MaterialIcons name="remove-circle" size={18} color={colors.danger} />
              <Text style={styles.consequenceText}>{t('focus.consistencyDamaged')}</Text>
            </View>
          </View>

          {penalty > 0 && (
            <View style={styles.penaltyCard}>
              <Text style={styles.penaltyText}>-{penalty} XP</Text>
              <Text style={styles.penaltyLabel}>{t('focus.penalty')}</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.tryAgainBtn} onPress={() => router.replace('/(tabs)/focus')} activeOpacity={0.85}>
            <MaterialIcons name="replay" size={20} color={colors.background} />
            <Text style={styles.tryAgainText}>{t('focus.retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
            <Text style={styles.homeBtnText}>{t('focus.returnHome')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0005' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  iconContainer: { marginBottom: Spacing.xl },
  iconBg: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.danger + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.danger + '44' },
  messageSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.xl },
  brokenTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, color: colors.danger, textAlign: 'center', includeFontPadding: false, marginBottom: Spacing.md },
  rudeMessage: { fontSize: FontSize.lg, color: colors.textPrimary, textAlign: 'center', lineHeight: 28, fontWeight: FontWeight.semiBold, marginBottom: Spacing.lg, fontStyle: 'italic' },
  consequences: { width: '100%', gap: 10, backgroundColor: colors.danger + '11', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: colors.danger + '22', marginBottom: Spacing.md },
  consequenceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consequenceText: { fontSize: FontSize.base, color: colors.textSecondary },
  penaltyCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerDim, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: colors.danger + '55' },
  penaltyText: { fontSize: 32, fontWeight: FontWeight.extraBold, color: colors.danger, includeFontPadding: false },
  penaltyLabel: { fontSize: FontSize.base, color: colors.danger + 'AA' },
  actions: { width: '100%', gap: 10 },
  tryAgainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.danger, borderRadius: Radius.md, paddingVertical: 16 },
  tryAgainText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  homeBtn: { backgroundColor: colors.surface, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  homeBtnText: { color: colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
});
