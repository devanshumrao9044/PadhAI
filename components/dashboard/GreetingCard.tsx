import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';

interface Props {
  name: string;
  streak: number;
}

export default function GreetingCard({ name, streak }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning');
    if (hour < 17) return t('home.goodAfternoon');
    return t('home.goodEvening');
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.greetingCopy}>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>{t('home.studyToday')}</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>{t('home.streak')}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  greetingCopy: { flex: 1, minWidth: 0 },
  greeting: { color: colors.primary, fontSize: 14, lineHeight: 20, marginBottom: 4, flexShrink: 1, fontWeight: '600' },
  name: { color: colors.textPrimary, fontSize: 23, lineHeight: 29, fontWeight: '800', marginBottom: 5, flexShrink: 1 },
  sub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  streakBox: { flexShrink: 0, alignItems: 'center', backgroundColor: colors.surfaceVariant, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, minWidth: 76, borderWidth: 1, borderColor: colors.borderStrong },
  streakEmoji: { fontSize: 24 },
  streakNum: { color: colors.accent, fontSize: 22, fontWeight: '900' },
  streakLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
});
