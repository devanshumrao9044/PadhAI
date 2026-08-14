import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize, FontWeight } from '@/constants/theme';
import { getLevelForUser, getXPProgressForUser } from '@/constants/levels';

interface XPBarProps {
  xp: number;
  compact?: boolean;
  levelRank?: number;
}

export default function XPBar({ xp, compact = false, levelRank }: XPBarProps) {
  const level = getLevelForUser({ xpTotal: xp, levelRank });
  const { current, needed, progress } = getXPProgressForUser({ xpTotal: xp, levelRank });

  return (
    <View style={styles.container}>
      <View style={[styles.track, compact ? styles.trackCompact : null]}>
        <View
          style={[
            styles.fill,
            compact ? styles.fillCompact : null,
            { width: `${Math.max(2, progress * 100)}%` as any, backgroundColor: level.color },
          ]}
        />
      </View>
      {!compact ? (
        <Text style={styles.label}>
          {current} / {needed} XP
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  track: {
    height: 8, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  trackCompact: { height: 4 },
  fill: {
    height: '100%', borderRadius: Radius.full,
    minWidth: 4,
  },
  fillCompact: {},
  label: {
    fontSize: FontSize.xs, color: Colors.textTertiary,
    marginTop: 4, textAlign: 'right',
  },
});
