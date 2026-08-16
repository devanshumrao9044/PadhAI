import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const shortcuts = [
  { emoji: '⏱️', label: 'Focus', route: '/(tabs)/focus', color: 'primary' as const },
  { emoji: '📚', label: 'Tracker', route: '/(tabs)/tracker', color: 'accent' as const },
  { emoji: '📊', label: 'Analytics', route: '/(tabs)/analytics', color: 'success' as const },
  { emoji: '👤', label: 'Profile', route: '/(tabs)/profile', color: 'warning' as const },
];

export default function QuickShortcuts() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Text style={styles.heading}>Quick Access ⚡</Text>
      <View style={styles.grid}>
        {shortcuts.map(item => (
          <TouchableOpacity key={item.label} style={[styles.card, { backgroundColor: colors[item.color] }]} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  heading: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { width: '47%', borderRadius: 16, padding: 20, alignItems: 'center' },
  emoji: { fontSize: 32, marginBottom: 8 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
