import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function StreakBadge({ streak, size = 'md' }: StreakBadgeProps) {
  const isAlive = streak > 0;
  const color = isAlive ? Colors.danger : Colors.textTertiary;
  const bg = isAlive ? Colors.danger + '22' : Colors.surfaceVariant;
  const borderColor = isAlive ? Colors.danger + '44' : Colors.border;

  const fontSize = size === 'sm' ? FontSize.sm : size === 'lg' ? FontSize.xl : FontSize.base;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const padding = size === 'sm' ? { paddingHorizontal: 8, paddingVertical: 4 } : { paddingHorizontal: 12, paddingVertical: 6 };

  return (
    <View style={[styles.badge, padding, { backgroundColor: bg, borderColor }]}>
      <MaterialIcons name="local-fire-department" size={iconSize} color={color} />
      <Text style={[styles.text, { color, fontSize }]}>{streak}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, borderWidth: 1,
  },
  text: { fontWeight: FontWeight.bold, includeFontPadding: false },
});
