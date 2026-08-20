import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';

type GoalOption = {
  minutes: number;
  label: string;
  subKey: 'goalLight' | 'goalSteady' | 'goalSerious' | 'goalIntense' | 'goalFull';
  emoji: string;
};

const GOALS: GoalOption[] = [
  { minutes: 60, label: '1 hour', subKey: 'goalLight', emoji: '🌱' },
  { minutes: 120, label: '2 hours', subKey: 'goalSteady', emoji: '📈' },
  { minutes: 180, label: '3 hours', subKey: 'goalSerious', emoji: '🎯' },
  { minutes: 300, label: '5 hours', subKey: 'goalIntense', emoji: '🔥' },
  { minutes: 480, label: '8 hours', subKey: 'goalFull', emoji: '⚡' },
];

interface Props {
  value: number;
  onChange: (val: number) => void;
}

export default function StepGoal({ value, onChange }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⏱️</Text>
      <Text style={styles.heading}>{t('onboarding.goalTitle')}</Text>
      <Text style={styles.subtext}>{t('onboarding.goalSubtitle')}</Text>
      <View style={styles.list}>
        {GOALS.map(goal => (
          <TouchableOpacity
            key={goal.minutes}
            style={[styles.card, value === goal.minutes && styles.cardSelected]}
            onPress={() => onChange(goal.minutes)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === goal.minutes }}
            accessibilityLabel={`${goal.label}. ${t(`onboarding.${goal.subKey}`)}`}
          >
            <Text style={styles.cardEmoji}>{goal.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={[styles.cardLabel, value === goal.minutes && styles.cardLabelSelected]}>
                {goal.label}
              </Text>
              <Text style={styles.cardSub}>{t(`onboarding.${goal.subKey}`)}</Text>
            </View>
            {value === goal.minutes ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 2 },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: 8 },
  heading: { color: colors.textPrimary, fontSize: 25, lineHeight: 32, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  subtext: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  list: { gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 12 },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '26' },
  cardEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  cardLabel: { color: colors.textPrimary, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  cardLabelSelected: { color: colors.primaryGlow },
  cardSub: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 1, flexShrink: 1 },
  check: { color: colors.primary, fontSize: 20, lineHeight: 22, fontWeight: '900' },
});
