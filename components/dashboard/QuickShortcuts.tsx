import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

const shortcuts = [
  { emoji: '📚', label: 'Notes', route: '/(tabs)/notes', color: '#1A3C8F' },
  { emoji: '📝', label: 'PYQ', route: '/(tabs)/pyq', color: '#6B21A8' },
  { emoji: '⏱️', label: 'Timer', route: '/(tabs)/timer', color: '#0F766E' },
  { emoji: '👤', label: 'Profile', route: '/(tabs)/profile', color: '#92400E' },
];

export default function QuickShortcuts() {
  return (
    <View>
      <Text style={styles.heading}>Quick Access ⚡</Text>
      <View style={styles.grid}>
        {shortcuts.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.card, { backgroundColor: item.color }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    width: '47%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
