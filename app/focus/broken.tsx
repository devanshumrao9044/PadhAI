import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { SESSION_BREAK_MESSAGES } from '@/constants/messages';

export default function FocusBrokenScreen() {
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
            <MaterialIcons name="cancel" size={80} color={Colors.danger} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.messageSection, { opacity: fadeAnim }]}>
           <Text style={styles.brokenTitle}>Session Broke</Text>
          <Text style={styles.rudeMessage}>{messageRef.current}</Text>

          <View style={styles.consequences}>
            <View style={styles.consequenceRow}>
              <MaterialIcons name="remove-circle" size={18} color={Colors.danger} />
              <Text style={styles.consequenceText}>{penalty > 0 ? `-${penalty} XP deducted` : 'XP penalized'}</Text>
            </View>
            <View style={styles.consequenceRow}>
              <MaterialIcons name="remove-circle" size={18} color={Colors.danger} />
              <Text style={styles.consequenceText}>Streak reset to 0</Text>
            </View>
            <View style={styles.consequenceRow}>
              <MaterialIcons name="remove-circle" size={18} color={Colors.danger} />
              <Text style={styles.consequenceText}>Consistency damaged</Text>
            </View>
          </View>

          {penalty > 0 && (
            <View style={styles.penaltyCard}>
              <Text style={styles.penaltyText}>-{penalty} XP</Text>
              <Text style={styles.penaltyLabel}>Penalty</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.tryAgainBtn} onPress={() => router.replace('/(tabs)/focus')} activeOpacity={0.85}>
            <MaterialIcons name="replay" size={20} color={Colors.background} />
            <Text style={styles.tryAgainText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
            <Text style={styles.homeBtnText}>Return Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0005' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  iconContainer: { marginBottom: Spacing.xl },
  iconBg: { width: 140, height: 140, borderRadius: 70, backgroundColor: Colors.danger + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.danger + '44' },
  messageSection: { alignItems: 'center', width: '100%', marginBottom: Spacing.xl },
  brokenTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, color: Colors.danger, textAlign: 'center', includeFontPadding: false, marginBottom: Spacing.md },
  rudeMessage: { fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center', lineHeight: 28, fontWeight: FontWeight.semiBold, marginBottom: Spacing.lg, fontStyle: 'italic' },
  consequences: { width: '100%', gap: 10, backgroundColor: Colors.danger + '11', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.danger + '22', marginBottom: Spacing.md },
  consequenceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consequenceText: { fontSize: FontSize.base, color: Colors.textSecondary },
  penaltyCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.dangerDim, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.danger + '55' },
  penaltyText: { fontSize: 32, fontWeight: FontWeight.extraBold, color: Colors.danger, includeFontPadding: false },
  penaltyLabel: { fontSize: FontSize.base, color: Colors.danger + 'AA' },
  actions: { width: '100%', gap: 10 },
  tryAgainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 16 },
  tryAgainText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  homeBtn: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  homeBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
});
