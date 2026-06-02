import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
