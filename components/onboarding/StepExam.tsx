import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const EXAMS = [
  { id: 'JEE', label: 'JEE', emoji: '⚛️', sub: 'IIT/NIT Engineering' },
  { id: 'NEET', label: 'NEET', emoji: '🩺', sub: 'Medical Entrance' },
  { id: 'BOARD', label: 'Board Exams', emoji: '📋', sub: 'Class 10 / 12' },
  { id: 'UPSC', label: 'UPSC', emoji: '🏛️', sub: 'Civil Services' },
  { id: 'OTHER', label: 'Other', emoji: '📚', sub: 'Any other goal' },
];

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function StepExam({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.heading}>Target</Text>
      <Text style={styles.subtext}>
        The app will be customized accordingly.
      </Text>
      <View style={styles.list}>
        {EXAMS.map((exam) => (
          <TouchableOpacity
            key={exam.id}
            style={[
              styles.card,
              value === exam.id && styles.cardSelected,
            ]}
            onPress={() => onChange(exam.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardEmoji}>{exam.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={[
                styles.cardLabel,
                value === exam.id && styles.cardLabelSelected,
              ]}>
                {exam.label}
              </Text>
              <Text style={styles.cardSub}>{exam.sub}</Text>
            </View>
            {value === exam.id && (
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
