import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Radius, Spacing, ThemeColors } from '@/constants/theme';
import { ChapterAnalytics } from '@/types/models';
import { buildChapterAnalyticsViewModel } from '@/services/chapterAnalytics';

type Props = {
  analytics: ChapterAnalytics[];
};

function getStatusColor(status: ChapterAnalytics['chapterStatus'], colors: ThemeColors): string {
  if (status === 'weak') return colors.warning;
  if (status === 'done') return colors.success;
  return colors.primary;
}

export default function ChapterAnalyticsCard({ analytics }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const studiedAnalytics = useMemo(
    () => analytics.filter(row => row.totalSessions > 0 || row.totalMinutes > 0),
    [analytics],
  );
  const visibleRows = useMemo(() => buildChapterAnalyticsViewModel(studiedAnalytics), [studiedAnalytics]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>CHAPTER FOCUS</Text>
          <Text style={styles.subtitle}>Time spent by chapter</Text>
        </View>
        <MaterialIcons name="auto-graph" size={20} color={colors.primary} />
      </View>

      {visibleRows.length === 0 ? (
        <Text style={styles.empty}>No chapter-linked sessions yet. Start a Study Session from Tracker.</Text>
      ) : (
        <>
          {visibleRows.map(view => {
            const row = view.analytics;
            const statusColor = getStatusColor(row.chapterStatus, colors);
            const barWidth = `${view.progressPercent}%`;
            return (
              <View key={row.chapterId} style={styles.row}>
                <View style={styles.rowHeader}>
                  <View style={styles.nameWrap}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={styles.name} numberOfLines={1}>{row.chapterName}</Text>
                  </View>
                  <Text style={styles.minutes}>{view.minutesLabel}</Text>
                </View>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: barWidth as `${number}%`, backgroundColor: statusColor }]} />
                </View>
                <Text style={styles.meta}>{view.sessionLabel}</Text>
              </View>
            );
          })}
          {studiedAnalytics.length > visibleRows.length ? (
            <Text style={styles.more}>+{studiedAnalytics.length - visibleRows.length} more studied chapters</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    color: colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 1.1,
  },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 3 },
  row: { marginTop: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1, color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  minutes: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  barBackground: { height: 7, marginTop: 7, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.full },
  meta: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 4 },
  empty: { color: colors.textSecondary, fontSize: FontSize.sm, paddingVertical: Spacing.sm },
  more: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, marginTop: Spacing.md },
});
