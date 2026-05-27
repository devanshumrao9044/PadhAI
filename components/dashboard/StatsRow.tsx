import { View, Text, StyleSheet } from 'react-native';

interface Props {
  todayMinutes: number;
  goalHours: number;
  totalNotes: number;
}

export default function StatsRow({ todayMinutes, goalHours, totalNotes }: Props) {
  const goalMinutes = goalHours * 60;
  const percent = Math.min(Math.round((todayMinutes / goalMinutes) * 100), 100);

  return (
    <View style={styles.row}>

      <View style={styles.card}>
        <Text style={styles.emoji}>⏱️</Text>
        <Text style={styles.value}>{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m</Text>
        <Text style={styles.label}>Aaj Padha</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.emoji}>🎯</Text>
        <Text style={[styles.value, { color: percent >= 100 ? '#4ADE80' : '#FACC15' }]}>
          {percent}%
        </Text>
        <Text style={styles.label}>Daily Goal</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.emoji}>📖</Text>
        <Text style={styles.value}>{totalNotes}</Text>
        <Text style={styles.label}>Notes Saved</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  emoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  label: {
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'center',
  },
});
