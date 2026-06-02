import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '@/hooks/useApp';

interface Props {
  todayMins?: number;
  xp?: number;
  chaptersTotal?: number;
  chaptersDone?: number;
}

export default function StatsRow({ todayMins = 0, xp = 0, chaptersTotal = 0, chaptersDone = 0 }: Props) {
  const { user, getDailySummary } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const summary = getDailySummary(todayStr);
  const todayMinutes = summary?.totalMinutes ?? todayMins;
  const goalMinutes = user?.dailyGoalMinutes || 120;
  const percent = Math.min(Math.round((todayMinutes / goalMinutes) * 100), 100);
  const hours = Math.floor(todayMinutes / 60);
  const minutes = todayMinutes % 60;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⏱️</Text>
          <Text style={styles.value}>{hours}h {minutes}m</Text>
          <Text style={styles.label}>Today Focus</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={[styles.value, { color: '#FACC15' }]}>{xp || user?.xpTotal || 0}</Text>
          <Text style={styles.label}>Total XP</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.emoji}>📚</Text>
          <Text style={styles.value}>{chaptersDone}/{chaptersTotal}</Text>
          <Text style={styles.label}>Chapters</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Daily Goal Progress</Text>
          <Text style={styles.progressText}>{todayMinutes} / {goalMinutes} mins</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${percent}%` as any, backgroundColor: percent >= 100 ? '#4ADE80' : '#8B5CF6' }
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: {
    flex: 1, backgroundColor: '#1C1C1E', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#2D2D2D',
  },
  emoji: { fontSize: 22, marginBottom: 6 },
  value: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  label: { color: '#6B7280', fontSize: 11, textAlign: 'center' },
  progressContainer: {
    backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2D2D2D',
  },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  progressTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  progressText: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: '#2D2D2D', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
});
