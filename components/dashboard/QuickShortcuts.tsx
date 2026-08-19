import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';

const shortcuts = [
  { emoji: '⏱️', key: 'studySession' as const, route: '/(tabs)/focus', color: 'primary' as const },
  { emoji: '📚', key: 'tracker' as const, route: '/(tabs)/tracker', color: 'accent' as const },
  { emoji: '📊', key: 'analytics' as const, route: '/(tabs)/analytics', color: 'success' as const },
  { emoji: '👤', key: 'profile' as const, route: '/(tabs)/profile', color: 'warning' as const },
];

export default function QuickShortcuts() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Text style={styles.heading}>{t('home.quickAccess')} ⚡</Text>
      <View style={styles.grid}>
        {shortcuts.map(item => (
          <TouchableOpacity key={item.key} style={[styles.card, { backgroundColor: colors[item.color] }]} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.label}>{t(`home.${item.key}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  heading: { color: colors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '700', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { width: '47%', minWidth: 0, borderRadius: 16, padding: 20, alignItems: 'center' },
  emoji: { fontSize: 32, marginBottom: 8 },
  label: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
