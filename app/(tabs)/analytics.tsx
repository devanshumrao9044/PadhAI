import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatMins(mins: number): string {
  if (mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getHeatColor(mins: number): string {
  if (mins === 0) return Colors.surfaceVariant;
  if (mins < 30) return Colors.primaryDim + '88';
  if (mins < 60) return Colors.primary + '66';
  if (mins < 120) return Colors.primary + 'AA';
  return Colors.primary;
}

export default function AnalyticsScreen() {
  const { user, sessions, getLast7Days, getLast90Days, getDailySummary, chapters } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const todaySummary = getDailySummary(today);
  const last7 = getLast7Days();
  const last90 = getLast90Days();

  const totalMins = last7.reduce((sum, d) => sum + d.totalMinutes, 0);
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.completed).length;
  const focusScore = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const maxMins = Math.max(...last7.map(d => d.totalMinutes), 60);

  const weakChapters = chapters.filter(c => !c.isDeleted && c.status === 'weak');
  const doneChapters = chapters.filter(c => !c.isDeleted && c.status === 'done').length;
  const totalChapters = chapters.filter(c => !c.isDeleted).length;

  // Subject breakdown
  const subjectMins: Record<string, number> = {};
  sessions.forEach(s => {
    if (s.subjectId) {
      subjectMins[s.subjectId] = (subjectMins[s.subjectId] ?? 0) + s.durationActualMins;
    }
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Analytics</Text>

        {/* Top stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="local-fire-department" size={20} color={Colors.danger} />
            <Text style={styles.statVal}>{user?.streakCurrent ?? 0}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="schedule" size={20} color={Colors.accent} />
            <Text style={styles.statVal}>{formatMins(totalMins)}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="bolt" size={20} color={Colors.warning} />
            <Text style={styles.statVal}>{focusScore}%</Text>
            <Text style={styles.statLabel}>Focus Score</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.statVal}>{doneChapters}/{totalChapters}</Text>
            <Text style={styles.statLabel}>Chapters Done</Text>
          </View>
        </View>

        {/* Weekly bar chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>IS HAFTE (HOURS)</Text>
          <View style={styles.barChart}>
            {last7.map((day, i) => {
              const barH = maxMins > 0 ? Math.max((day.totalMinutes / maxMins) * 120, day.totalMinutes > 0 ? 4 : 0) : 0;
              const isToday = day.date === today;
              const dateObj = new Date(day.date + 'T12:00:00');
              const dayIdx = dateObj.getDay();
              return (
                <View key={day.date} style={styles.barCol}>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar,
                      { height: Math.max(barH, 2) },
                      isToday ? styles.barToday : null,
                      day.goalMet ? styles.barGoalMet : null,
                    ]} />
                  </View>
                  <Text style={[styles.barLabel, isToday ? styles.barLabelToday : null]}>
                    {SHORT_DAYS[dayIdx]}
                  </Text>
                  <Text style={styles.barMins}>{formatMins(day.totalMinutes)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Heatmap */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONSISTENCY (90 DAYS)</Text>
          <View style={styles.heatmap}>
            {Array.from({ length: 13 }, (_, weekIdx) => (
              <View key={weekIdx} style={styles.heatCol}>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const idx = weekIdx * 7 + dayIdx;
                  const entry = last90[idx];
                  return (
                    <View
                      key={dayIdx}
                      style={[styles.heatCell, { backgroundColor: entry ? getHeatColor(entry.totalMinutes) : Colors.surfaceVariant }]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.heatLegend}>
            <Text style={styles.heatLegendText}>Less</Text>
            {[0, 30, 60, 120, 180].map(v => (
              <View key={v} style={[styles.heatLegendDot, { backgroundColor: getHeatColor(v) }]} />
            ))}
            <Text style={styles.heatLegendText}>More</Text>
          </View>
        </View>

        {/* Weak chapters */}
        {weakChapters.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>WEAK CHAPTERS ({weakChapters.length})</Text>
            {weakChapters.map(c => (
              <View key={c.id} style={styles.weakRow}>
                <MaterialIcons name="warning" size={14} color={Colors.warning} />
                <Text style={styles.weakText}>{c.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Focus score details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FOCUS SCORE</Text>
          <View style={styles.focusScoreRow}>
            <Text style={styles.focusScoreVal}>{focusScore}%</Text>
            <View style={styles.focusScoreDetails}>
              <Text style={styles.focusScoreDetail}>
                <Text style={styles.focusScoreGreen}>{completedSessions}</Text> completed
              </Text>
              <Text style={styles.focusScoreDetail}>
                <Text style={styles.focusScoreRed}>{totalSessions - completedSessions}</Text> broken
              </Text>
            </View>
          </View>
          <View style={styles.focusBar}>
            <View style={[styles.focusFill, { width: `${focusScore}%` as any }]} />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xl },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
    color: Colors.textPrimary, marginBottom: Spacing.md, includeFontPadding: false,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, includeFontPadding: false },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 1.2,
    marginBottom: Spacing.md, textTransform: 'uppercase',
  },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 160 },
  barCol: { flex: 1, alignItems: 'center' },
  barContainer: { height: 120, justifyContent: 'flex-end' },
  bar: {
    width: '100%', minWidth: 24, borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  barToday: { backgroundColor: Colors.primary },
  barGoalMet: { backgroundColor: Colors.success },
  barLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 },
  barLabelToday: { color: Colors.primary, fontWeight: FontWeight.semiBold },
  barMins: { fontSize: 9, color: Colors.textTertiary, marginTop: 2 },
  heatmap: { flexDirection: 'row', gap: 3 },
  heatCol: { gap: 3 },
  heatCell: { width: 18, height: 18, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  heatLegendText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  heatLegendDot: { width: 12, height: 12, borderRadius: 2 },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  weakText: { fontSize: FontSize.base, color: Colors.warning, flex: 1 },
  focusScoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  focusScoreVal: { fontSize: 44, fontWeight: FontWeight.extraBold, color: Colors.primary, includeFontPadding: false },
  focusScoreDetails: { gap: 4 },
  focusScoreDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  focusScoreGreen: { color: Colors.success, fontWeight: FontWeight.semiBold },
  focusScoreRed: { color: Colors.danger, fontWeight: FontWeight.semiBold },
  focusBar: { height: 8, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  focusFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
});
