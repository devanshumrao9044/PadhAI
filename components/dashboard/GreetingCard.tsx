import { View, Text, StyleSheet } from 'react-native';

interface Props {
  name: string;
  streak: number;
}

export default function GreetingCard({ name, streak }: Props) {
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>Aaj bhi padhai karni hai! 💪</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>Streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#6B21A8',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#E9D5FF',
    fontSize: 14,
    marginBottom: 4,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  sub: {
    color: '#C4B5FD',
    fontSize: 13,
  },
  streakBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 12,
    minWidth: 70,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakNum: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  streakLabel: {
    color: '#E9D5FF',
    fontSize: 11,
    marginTop: 2,
  },
});
