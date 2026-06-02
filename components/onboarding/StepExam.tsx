import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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

const styles = StyleSheet.create({
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
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    color: '#6B7280',
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
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    gap: 14,
  },
  cardSelected: {
    borderColor: '#6B21A8',
    backgroundColor: '#1E1033',
  },
  cardEmoji: {
    fontSize: 26,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardLabelSelected: {
    color: '#A78BFA',
  },
  cardSub: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  check: {
    color: '#6B21A8',
    fontSize: 20,
    fontWeight: '900',
  },
});
