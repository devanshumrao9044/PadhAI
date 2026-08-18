import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useApp } from '@/hooks/useApp';

function formatMins(mins: number): string {
  if (mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getHeatColor(mins: number, colors: ThemeColors): string {
  if (mins === 0) return colors.surfaceVariant;
  if (mins < 30) return colors.primaryDim + '88';
  if (mins < 60) return colors.primary + '66';
  if (mins < 120) return colors.primary + 'AA';
  return colors.primary;
}

function createChartConfig(colors: ThemeColors) {
  return {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(124, 92, 252, ${opacity})`,
    labelColor: () => colors.textSecondary,
    style: { borderRadius: Radius.md },
    propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '4' },
    propsForLabels: { fontSize: 11 },
    barPercentage: 0.6,
  };
}

function createLineChartConfig(colors: ThemeColors) {
  return {
    ...createChartConfig(colors),
    color: (opacity = 1) => `rgba(79, 195, 247, ${opacity})`,
    fillShadowGradient: colors.accent,
    fillShadowGradientOpacity: 0.25,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.accent,
      fill: colors.surface,
    },
  };
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chartConfig = useMemo(() => createChartConfig(colors), [colors]);
  const lineChartConfig = useMemo(() => createLineChartConfig(colors), [colors]);
  const { user, sessions, last7Days: last7, last30Days: last30, chapters, chapterAnalytics, getDailySummary, reload } = useApp();
  const userId = user?.id ?? null;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) return;
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      void reload({ force: true });
    }, 250);
  }, [reload]);

  useEffect(() => () => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return undefined;
    }, [reload]),
  );

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`analytics-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${userId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` }, scheduleReload)
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [scheduleReload, userId]);

  // SSR-safe dimensions
  const [screenWidth, setScreenWidth] = useState(() => Math.max(320, Dimensions.get('window').width));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(Math.max(320, window.width));
    });
    return () => sub?.remove();
  }, []);
  const CHART_WIDTH = Math.max(1, screenWidth - Spacing.md * 2 - 2);

  const today = new Date().toISOString().split('T')[0];
  const shortDays = useMemo(() => [
    t('analytics.sun'), t('analytics.mon'), t('analytics.tue'), t('analytics.wed'),
    t('analytics.thu'), t('analytics.fri'), t('analytics.sat'),
  ], [t]);

  // ── Summary Stats ────────────────────────────────────────────────────────
  const {
    totalMins,
    totalSessions,
    completedSessions,
    focusScore,
    doneChapters,
    totalChapters,
    weakChapters,
  } = useMemo(() => {
    const totalMins = last7.reduce((sum, d) => sum + d.totalMinutes, 0);
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.completed).length;
    const focusScore = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
    const activeChapters = chapters.filter(c => c.isDeleted === false);
    const trackedChapterIds = new Set(
      chapterAnalytics
        .filter(row => row.totalSessions > 0 || row.totalMinutes > 0)
        .map(row => row.chapterId),
    );
    const doneChapters = activeChapters.filter(c => c.status === 'done').length;
    const weakChapters = activeChapters.filter(c => c.status === 'weak' && trackedChapterIds.has(c.id));
    return {
      totalMins,
      totalSessions,
      completedSessions,
      focusScore,
      doneChapters,
      totalChapters: activeChapters.length,
      weakChapters,
    };
  }, [chapterAnalytics, chapters, last7, sessions]);

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
  }, [goalProgress, progressAnim]);

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#FF4757', '#FFB547', '#4CAF7D'],
  });

  const last7GoalMet = useMemo(() => last7.map(d => d.goalMet), [last7]);

  // ── Bar Chart: Daily Focus Minutes (last 7 days) ──────────────────────────
  const barData = useMemo(() => {
    const labels = last7.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      return shortDays[dateObj.getDay()];
    });
    const data = last7.map(d => Math.round(d.totalMinutes));
    return { labels, datasets: [{ data }] };
  }, [last7, shortDays]);

  // ── Line Chart: Chapter completion over last 7 days ───────────────────────
  const lineData = useMemo(() => {
    // Build cumulative chapter completions per day for last 7 days
    const dates = last7.map(d => d.date);
    const labels = last7.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      return shortDays[dateObj.getDay()];
    });

    const doneCounts = dates.map(date => {
      return chapters.filter(
        c => c.isDeleted === false && c.status === 'done' && c.completedDate && c.completedDate <= date
      ).length;
    });

    return { labels, datasets: [{ data: doneCounts.length > 0 ? doneCounts : [0, 0, 0, 0, 0, 0, 0] }] };
  }, [last7, chapters, shortDays]);

  // ── XP trend (last 7 days) ────────────────────────────────────────────────
  const xpBarData = useMemo(() => {
    const labels = last7.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      return shortDays[dateObj.getDay()];
    });
    const data = last7.map(d => d.xpEarned ?? 0);
    return { labels, datasets: [{ data }] };
  }, [last7, shortDays]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('analytics.title')}</Text>

        {/* ── Top Stats Grid ─────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="local-fire-department" size={20} color={colors.danger} />
            <Text style={styles.statVal}>{user?.streakCurrent ?? 0}</Text>
            <Text style={styles.statLabel}>{t('analytics.currentStreak')}</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="schedule" size={20} color={colors.accent} />
            <Text style={styles.statVal}>{formatMins(totalMins)}</Text>
            <Text style={styles.statLabel}>{t('analytics.thisWeek')}</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="bolt" size={20} color={colors.warning} />
            <Text style={styles.statVal}>{focusScore}%</Text>
            <Text style={styles.statLabel}>{t('analytics.focusScore')}</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={20} color={colors.success} />
            <Text style={styles.statVal}>{doneChapters}/{totalChapters}</Text>
            <Text style={styles.statLabel}>{t('analytics.chaptersDone')}</Text>
          </View>
        </View>

        {/* ── Today Goal Progress ──────────────────────────────────────── */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalLabel}>{t('analytics.todaysGoal')}</Text>
              <Text style={styles.goalFraction}>
                <Text style={[styles.goalCurrent, goalMet && { color: colors.success }]}>
                  {formatMins(todayMins)}
                </Text>
                <Text style={styles.goalSeparator}> / </Text>
                <Text style={styles.goalTotal}>{formatMins(goalMins)}</Text>
              </Text>
            </View>
            <View style={[styles.goalBadge, goalMet && styles.goalBadgeMet]}>
              <Text style={[styles.goalBadgeText, goalMet && styles.goalBadgeTextMet]}>
                {goalMet ? t('analytics.done') : `${Math.round(goalProgress * 100)}%`}
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
              const dayLabel = shortDays[new Date(d.date + 'T12:00:00').getDay()];
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
                  <Text style={[styles.weekDayLabel, isToday && { color: colors.textPrimary }]}>
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
            <Text style={styles.cardTitle}>{t('analytics.dailyFocus')}</Text>
            <Text style={styles.cardSubtitle}>{t('analytics.last7Days')}</Text>
          </View>
          <BarChart
            data={barData}
            width={CHART_WIDTH}
            height={200}
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
            withInnerLines
            yAxisLabel={""}
            yAxisSuffix={"m"}
            verticalLabelRotation={0}
          />
        </View>

        {/* ── Line Chart: Chapter Completion Trend ─────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('analytics.chapterCompletionTrend')}</Text>
            <Text style={styles.cardSubtitle}>{t('analytics.cumulative7Days')}</Text>
          </View>
          <LineChart
            data={lineData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={lineChartConfig}
            style={styles.chart}
            bezier
            fromZero
            withInnerLines
            withShadow={false}
            yAxisLabel={""}
            yAxisSuffix={""}
          />
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>{t('analytics.chaptersCompletedCumulative')}</Text>
          </View>
        </View>

        {/* ── Bar Chart: XP Earned Per Day ─────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('analytics.xpEarnedPerDay')}</Text>
            <Text style={styles.cardSubtitle}>{t('analytics.last7Days')}</Text>
          </View>
          <BarChart
            data={xpBarData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(255, 181, 71, ${opacity})`,
            }}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
            withInnerLines
            yAxisLabel={""}
            yAxisSuffix={""}
          />
        </View>

        {/* ── Focus Score ──────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.focusScoreDetails')}</Text>
          <View style={styles.focusScoreRow}>
            <Text style={styles.focusScoreVal}>{focusScore}%</Text>
            <View style={styles.focusScoreDetails}>
              <Text style={styles.focusScoreDetail}>
                <Text style={styles.focusScoreGreen}>{completedSessions}</Text> {t('analytics.completed')}
              </Text>
              <Text style={styles.focusScoreDetail}>
                <Text style={styles.focusScoreRed}>{totalSessions - completedSessions}</Text> {t('analytics.broken')}
              </Text>
            </View>
          </View>
          <View style={styles.focusBar}>
            <View style={[styles.focusFill, { width: `${focusScore}%` as any }]} />
          </View>
        </View>

        {/* ── Heatmap: 30-day Consistency ──────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.consistency30')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmap}>
              {Array.from({ length: 5 }, (_, weekIdx) => (
                <View key={weekIdx} style={styles.heatCol}>
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const idx = weekIdx * 7 + dayIdx;
                    const entry = last30[idx];
                    return (
                      <View
                        key={dayIdx}
                        style={[styles.heatCell, {
                          backgroundColor: entry ? getHeatColor(entry.totalMinutes, colors) : colors.surfaceVariant,
                        }]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.heatLegend}>
            <Text style={styles.heatLegendText}>{t('analytics.less')}</Text>
            {[0, 30, 60, 120, 180].map(v => (
              <View key={v} style={[styles.heatLegendDot, { backgroundColor: getHeatColor(v, colors) }]} />
            ))}
            <Text style={styles.heatLegendText}>{t('analytics.more')}</Text>
          </View>
        </View>

        {/* ── Weak Chapters ────────────────────────────────────────────────── */}
        {weakChapters.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('analytics.weakChapters', { value: weakChapters.length })}</Text>
            {weakChapters.map(c => (
              <View key={c.id} style={styles.weakRow}>
                <MaterialIcons name="warning" size={14} color={colors.warning} />
                <Text style={styles.weakText}>{c.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 110 },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
    color: colors.textPrimary, marginBottom: Spacing.md, includeFontPadding: false,
  },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textPrimary, includeFontPadding: false },
  statLabel: { fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, marginBottom: Spacing.md, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: colors.textTertiary, letterSpacing: 1.2, textTransform: 'uppercase',
  },
  cardSubtitle: { fontSize: FontSize.xs, color: colors.textTertiary },

  // Chart
  chart: { marginLeft: -Spacing.md, borderRadius: Radius.md },

  // Legend
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FontSize.xs, color: colors.textSecondary },

  // Focus Score
  focusScoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  focusScoreVal: { fontSize: 44, fontWeight: FontWeight.extraBold, color: colors.primary, includeFontPadding: false },
  focusScoreDetails: { gap: 4 },
  focusScoreDetail: { fontSize: FontSize.sm, color: colors.textSecondary },
  focusScoreGreen: { color: colors.success, fontWeight: FontWeight.semiBold },
  focusScoreRed: { color: colors.danger, fontWeight: FontWeight.semiBold },
  focusBar: { height: 8, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  focusFill: { height: '100%', backgroundColor: colors.primary, borderRadius: Radius.full },

  // Heatmap
  heatmap: { flexDirection: 'row', gap: 3 },
  heatCol: { gap: 3 },
  heatCell: { width: 18, height: 18, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  heatLegendText: { fontSize: FontSize.xs, color: colors.textTertiary },
  heatLegendDot: { width: 12, height: 12, borderRadius: 2 },

  // Weak
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  weakText: { fontSize: FontSize.base, color: colors.warning, flex: 1 },

  // Today Goal Progress Card
  goalCard: {
    backgroundColor: colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  goalLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: colors.textTertiary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  goalFraction: { flexDirection: 'row', alignItems: 'baseline' } as any,
  goalCurrent: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.primary, includeFontPadding: false },
  goalSeparator: { fontSize: FontSize.base, color: colors.textTertiary },
  goalTotal: { fontSize: FontSize.base, color: colors.textSecondary, fontWeight: FontWeight.medium },
  goalBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border,
  },
  goalBadgeMet: { backgroundColor: colors.success + '22', borderColor: colors.success + '55' },
  goalBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: colors.textSecondary },
  goalBadgeTextMet: { color: colors.success },
  goalBarBg: {
    height: 10, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full,
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
  weekDotMet: { backgroundColor: colors.success + '22', borderColor: colors.success },
  weekDotMiss: { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
  weekDotToday: { borderColor: colors.primary, borderWidth: 2 },
  weekDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textTertiary },
  weekCheck: { fontSize: 14, color: colors.success, fontWeight: FontWeight.bold },
  weekDayLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: FontWeight.medium },
});
