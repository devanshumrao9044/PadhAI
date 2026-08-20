import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';

const shortcuts = [
  { icon: 'timer' as const, key: 'studySession' as const, route: '/(tabs)/focus', color: 'primary' as const },
  { icon: 'library-books' as const, key: 'tracker' as const, route: '/(tabs)/tracker', color: 'accent' as const },
  { icon: 'insights' as const, key: 'analytics' as const, route: '/(tabs)/analytics', color: 'success' as const },
  { icon: 'person-outline' as const, key: 'profile' as const, route: '/(tabs)/profile', color: 'warning' as const },
];

export default function QuickShortcuts() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t('home.quickAccess')}</Text>
        <Text style={styles.headingHint}>4</Text>
      </View>
      <View style={styles.grid}>
        {shortcuts.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t(`home.${item.key}`)}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors[item.color] + '18' }]}>
              <MaterialIcons name={item.icon} size={22} color={colors[item.color]} />
            </View>
            <Text style={styles.label}>{t(`home.${item.key}`)}</Text>
            <MaterialIcons name="arrow-forward" size={17} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { color: colors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  headingHint: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { width: '47%', minWidth: 0, minHeight: 104, justifyContent: 'space-between', borderRadius: 16, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
});
