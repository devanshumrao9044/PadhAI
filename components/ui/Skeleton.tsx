import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { backgroundColor: colors.surfaceVariant }, style, { opacity }]} />;
}

export function NotificationSkeletonList() {
  const { colors } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: colors.background }]}>
      {Array.from({ length: 4 }, (_, index) => (
        <View key={index} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton style={styles.icon} />
          <View style={styles.copy}>
            <Skeleton style={styles.title} />
            <Skeleton style={styles.line} />
            <Skeleton style={styles.shortLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ReferralSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.referral, { backgroundColor: colors.background }]}>
      <Skeleton style={styles.referralHeader} />
      <Skeleton style={styles.referralHero} />
      <Skeleton style={styles.referralCard} />
      <Skeleton style={styles.referralCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 8 },
  list: { flex: 1, padding: 16, gap: 12 },
  card: { minHeight: 108, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19 },
  copy: { flex: 1, gap: 10, paddingTop: 2 },
  title: { width: '62%', height: 15 },
  line: { width: '96%', height: 13 },
  shortLine: { width: '42%', height: 12 },
  referral: { flex: 1, padding: 20, gap: 16 },
  referralHeader: { width: '42%', height: 24, marginTop: 10 },
  referralHero: { width: '100%', height: 150, borderRadius: 20 },
  referralCard: { width: '100%', height: 110, borderRadius: 18 },
});
