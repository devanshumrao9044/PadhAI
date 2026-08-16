import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors, Radius, FontSize, FontWeight } from '@/constants/theme';

interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function StreakBadge({ streak, size = 'md' }: StreakBadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAlive = streak > 0;
  const color = isAlive ? colors.danger : colors.textTertiary;
  const bg = isAlive ? colors.danger + '22' : colors.surfaceVariant;
  const borderColor = isAlive ? colors.danger + '44' : colors.border;

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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, borderWidth: 1,
  },
  text: { fontWeight: FontWeight.bold, includeFontPadding: false },
});
