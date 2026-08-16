import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { getThoughtForDate } from '@/constants/dailyThoughts';

export default function QuoteCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const thought = useMemo(() => getThoughtForDate(), []);

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>💭</Text>
      <Text style={styles.quote}>{`"${thought.en}"`}</Text>
      <Text style={styles.quoteHi}>{thought.hi}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary, marginBottom: 24 },
  icon: { fontSize: 24, marginBottom: 10 },
  quote: { color: colors.textPrimary, fontSize: 15, fontStyle: 'italic', lineHeight: 22, marginBottom: 8 },
  quoteHi: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' },
});
