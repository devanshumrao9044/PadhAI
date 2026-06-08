import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2 - 2; // card padding

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const CHART_CONFIG = {
  backgroundColor: Colors.surface,
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(124, 92, 252, ${opacity})`,
  labelColor: () => Colors.textSecondary,
  style: { borderRadius: Radius.md },
  propsForBackgroundLines: { stroke: Colors.border, strokeDasharray: '4' },
  propsForLabels: { fontSize: 11 },
  barPercentage: 0.6,
};

const LINE_CHART_CONFIG = {
  ...CHART_CONFIG,
  color: (opacity = 1) => `rgba(79, 195, 247, ${opacity})`,
  fillShadowGradient: Colors.accent,
  fillShadowGradientOpacity: 0.25,
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: Colors.accent,
    fill: Colors.surface,
  },
};

export default function AnalyticsScreen() {
  const { user, sessions, getLast7Days, getLast90Days, chapters, getDailySummary } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const last7 = getLast7Days();
  const last90 = getLast90Days();

  // ── Summary Stats ────────────────────────────────────────────────────────
  const totalMins = last7.reduce((sum, d) => sum + d.totalMinutes, 0);
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.completed).length;
  const focusScore = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const doneChapters = chapters.filter(c => !c.isDeleted && c.status === 'done').length;
  const totalChapters = chapters.filter(c => !c.isDeleted).length;
  const weakChapters = chapters.filter(c => !c.isDeleted && c.status === 'weak');

  // ── Today Goal Progress ───────────────────────────────────────────────────
  const todaySummary = getDailySummary(today);
  const todayMins = todaySummary?.totalMinutes ?? 0;
  const goalMins = user?.dailyGoalMinutes ?? 120;
  const goalProgress = Math.min(todayMins / goalMins, 1);
  const goalMet = todayMins >= goalMins;

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: goalProgress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [goalProgress]);

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#FF4757', '#FFB547', '#4CAF7D'],
  });

  const last7GoalMet = last7.map(d => d.goalMet);

  // ── Bar Chart: Daily Focus Minutes (last 7 days) ──────────────────────────
  const barData = useMemo(() => {
    const labels = last7.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      return SHORT_DAYS[dateObj.getDay()];
    });
    const data = last7.map(d => Math.round(d.totalMinutes));
    return { labels, datasets: [{ data }] };
  }, [last7]);

  // ── Line Chart: Chapter completion over last 7 days ───────────────────────
  const lineData = useMemo(() => {
    // Build cumulative chapter completions per day for last 7 days
    const dates = last7.map(d => d.date);
    const labels = last7.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      return SHORT_DAYS[dateObj.getDay()];
    });

    const doneCounts = dates.map(date => {
      return chapters.filter(
        c => !c.isDeleted && c.status === 'done' && c.completedDate && c.completedDate <= date
      ).length;
    });

    return { labels, datasets: [{ data: doneCounts.length > 0 ? doneCounts : [0, 0, 0, 0, 0, 0, 0] }] };
  }, [last7, chapters]);

  // ── XP trend (last 7 days) ────────────────────────────────────────────────
  const xpBarData = useMemo(() => {
    const labels = last7.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      return SHORT_DAYS[dateObj.getDay()];
    });
    const data = last7.map(d => d.xpEarned ?? 0);
    return { labels, datasets: [{ data }] };
  }, [last7]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Analytics</Text>

        {/* ── Top Stats Grid ─────────────────────────────────────────────── */}
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

        {/* ── Today Goal Progress ──────────────────────────────────────── */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalLabel}>TODAY'S GOAL</Text>
              <Text style={styles.goalFraction}>
                <Text style={[styles.goalCurrent, goalMet && { color: Colors.success }]}>
                  {formatMins(todayMins)}
                </Text>
                <Text style={styles.goalSeparator}> / </Text>
                <Text style={styles.goalTotal}>{formatMins(goalMins)}</Text>
              </Text>
            </View>
            <View style={[styles.goalBadge, goalMet && styles.goalBadgeMet]}>
              <Text style={[styles.goalBadgeText, goalMet && styles.goalBadgeTextMet]}>
                {goalMet ? '✓ Done' : `${Math.round(goalProgress * 100)}%`}
              </Text>
            </View>
          </View>

          {/* Animated bar */}
          <View style={styles.goalBarBg}>
            <Animated.View
              style={[
                styles.goalBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>

          {/* 7-day goal streak dots */}
          <View style={styles.weekRow}>
            {last7GoalMet.map((met, i) => {
              const d = last7[i];
              const dayLabel = SHORT_DAYS[new Date(d.date + 'T12:00:00').getDay()];
              const isToday = d.date === today;
              return (
                <View key={i} style={styles.weekDayCol}>
                  <View style={[
                    styles.weekDot,
                    met ? styles.weekDotMet : styles.weekDotMiss,
                    isToday && styles.weekDotToday,
                  ]}>
                    {met ? (
                      <Text style={styles.weekCheck}>✓</Text>
                    ) : (
                      <View style={styles.weekDotInner} />
                    )}
                  </View>
                  <Text style={[styles.weekDayLabel, isToday && { color: Colors.textPrimary }]}>
                    {dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Bar Chart: Focus Minutes ───────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>DAILY FOCUS (MINUTES)</Text>
            <Text style={styles.cardSubtitle}>Last 7 days</Text>
          </View>
          <BarChart
            data={barData}
            width={CHART_WIDTH}
            height={200}
            chartConfig={CHART_CONFIG}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
            withInnerLines
            yAxisLabel=""
            yAxisSuffix="m"
            verticalLabelRotation={0}
          />
        </View>

        {/* ── Line Chart: Chapter Completion Trend ─────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>CHAPTER COMPLETION TREND</Text>
            <Text style={styles.cardSubtitle}>Cumulative over 7 days</Text>
          </View>
          <LineChart
            data={lineData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={LINE_CHART_CONFIG}
            style={styles.chart}
            bezier
            fromZero
            withInnerLines
            withShadow={false}
            yAxisLabel=""
            yAxisSuffix=""
          />
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
            <Text style={styles.legendText}>Chapters completed (cumulative)</Text>
          </View>
        </View>

        {/* ── Bar Chart: XP Earned Per Day ─────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>XP EARNED PER DAY</Text>
            <Text style={styles.cardSubtitle}>Last 7 days</Text>
          </View>
          <BarChart
            data={xpBarData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={{
              ...CHART_CONFIG,
              color: (opacity = 1) => `rgba(255, 181, 71, ${opacity})`,
            }}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
            withInnerLines
            yAxisLabel=""
            yAxisSuffix=""
          />
        </View>

        {/* ── Focus Score ──────────────────────────────────────────────────── */}
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

        {/* ── Heatmap: 90-day Consistency ──────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONSISTENCY (90 DAYS)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmap}>
              {Array.from({ length: 13 }, (_, weekIdx) => (
                <View key={weekIdx} style={styles.heatCol}>
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const idx = weekIdx * 7 + dayIdx;
                    const entry = last90[idx];
                    return (
                      <View
                        key={dayIdx}
                        style={[styles.heatCell, {
                          backgroundColor: entry ? getHeatColor(entry.totalMinutes) : Colors.surfaceVariant,
                        }]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.heatLegend}>
            <Text style={styles.heatLegendText}>Less</Text>
            {[0, 30, 60, 120, 180].map(v => (
              <View key={v} style={[styles.heatLegendDot, { backgroundColor: getHeatColor(v) }]} />
            ))}
            <Text style={styles.heatLegendText}>More</Text>
          </View>
        </View>

        {/* ── Weak Chapters ────────────────────────────────────────────────── */}
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

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 110 },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
    color: Colors.textPrimary, marginBottom: Spacing.md, includeFontPadding: false,
  },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, includeFontPadding: false },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 1.2, textTransform: 'uppercase',
  },
  cardSubtitle: { fontSize: FontSize.xs, color: Colors.textTertiary },

  // Chart
  chart: { marginLeft: -Spacing.md, borderRadius: Radius.md },

  // Legend
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Focus Score
  focusScoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  focusScoreVal: { fontSize: 44, fontWeight: FontWeight.extraBold, color: Colors.primary, includeFontPadding: false },
  focusScoreDetails: { gap: 4 },
  focusScoreDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  focusScoreGreen: { color: Colors.success, fontWeight: FontWeight.semiBold },
  focusScoreRed: { color: Colors.danger, fontWeight: FontWeight.semiBold },
  focusBar: { height: 8, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  focusFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },

  // Heatmap
  heatmap: { flexDirection: 'row', gap: 3 },
  heatCol: { gap: 3 },
  heatCell: { width: 18, height: 18, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  heatLegendText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  heatLegendDot: { width: 12, height: 12, borderRadius: 2 },

  // Weak
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  weakText: { fontSize: FontSize.base, color: Colors.warning, flex: 1 },

  // Today Goal Progress Card
  goalCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  goalLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  goalFraction: { flexDirection: 'row', alignItems: 'baseline' } as any,
  goalCurrent: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, includeFontPadding: false },
  goalSeparator: { fontSize: FontSize.base, color: Colors.textTertiary },
  goalTotal: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  goalBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border,
  },
  goalBadgeMet: { backgroundColor: Colors.success + '22', borderColor: Colors.success + '55' },
  goalBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  goalBadgeTextMet: { color: Colors.success },
  goalBarBg: {
    height: 10, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.full,
    overflow: 'hidden', marginBottom: 16,
  },
  goalBarFill: { height: '100%', borderRadius: Radius.full },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDayCol: { alignItems: 'center', gap: 5 },
  weekDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  weekDotMet: { backgroundColor: Colors.success + '22', borderColor: Colors.success },
  weekDotMiss: { backgroundColor: Colors.surfaceVariant, borderColor: Colors.border },
  weekDotToday: { borderColor: Colors.primary, borderWidth: 2 },
  weekDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary },
  weekCheck: { fontSize: 14, color: Colors.success, fontWeight: FontWeight.bold },
  weekDayLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: FontWeight.medium },
});
