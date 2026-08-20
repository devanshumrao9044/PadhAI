import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const GOALS = [
  { minutes: 60,  label: '1 Hour',   sub: 'Light — Maintenance mode',  emoji: '🌱' },
  { minutes: 120, label: '2 Hours',  sub: 'Moderate — Steady progress', emoji: '📈' },
  { minutes: 180, label: '3 Hours',  sub: 'Serious — Exam focused',     emoji: '🔥' },
  { minutes: 300, label: '5 Hours',  sub: 'Intense — Full grind',       emoji: '⚡' },
  { minutes: 480, label: '8 Hours',  sub: 'Beast mode — All in',        emoji: '💀' },
];

interface Props {
  value: number;
  onChange: (val: number) => void;
}

export default function StepGoal({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⏱️</Text>
      <Text style={styles.heading}>how much do you read every day ?</Text>
      <Text style={styles.subtext}>
        Be honest – the app will judge you accordingly
      </Text>
      <View style={styles.list}>
        {GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.minutes}
            style={[
              styles.card,
              value === goal.minutes && styles.cardSelected,
            ]}
            onPress={() => onChange(goal.minutes)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardEmoji}>{goal.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={[
                styles.cardLabel,
                value === goal.minutes && styles.cardLabelSelected,
              ]}>
                {goal.label}
              </Text>
              <Text style={styles.cardSub}>{goal.sub}</Text>
            </View>
            {value === goal.minutes && (
              <Text style={styles.check}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 16,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    color: colors.textTertiary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '26',
  },
  cardEmoji: {
    fontSize: 26,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  cardLabelSelected: {
    color: colors.primaryGlow,
  },
  cardSub: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  check: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
});
