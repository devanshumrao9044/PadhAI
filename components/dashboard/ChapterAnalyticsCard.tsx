import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { FontSize, FontWeight, Radius, Spacing, ThemeColors } from '@/constants/theme';
import { ChapterAnalytics } from '@/types/models';
import { buildChapterAnalyticsViewModel, filterChapterAnalyticsByActiveChapterIds } from '@/services/chapterAnalytics';

type Props = {
  analytics: ChapterAnalytics[];
  activeChapterIds: ReadonlySet<string>;
};

function getStatusColor(status: ChapterAnalytics['chapterStatus'], colors: ThemeColors): string {
  if (status === 'weak') return colors.warning;
  if (status === 'done') return colors.success;
  return colors.primary;
}

export default function ChapterAnalyticsCard({ analytics, activeChapterIds }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const studiedAnalytics = useMemo(
    () => filterChapterAnalyticsByActiveChapterIds(analytics, activeChapterIds)
      .filter(row => row.totalSessions > 0 || row.totalMinutes > 0),
    [activeChapterIds, analytics],
  );
  const visibleRows = useMemo(() => buildChapterAnalyticsViewModel(studiedAnalytics), [studiedAnalytics]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('home.chapterFocus')}</Text>
          <Text style={styles.subtitle}>{t('home.timeSpentByChapter')}</Text>
        </View>
        <MaterialIcons name="auto-graph" size={20} color={colors.primary} />
      </View>

      {visibleRows.length === 0 ? (
        <Text style={styles.empty}>{t('home.noChapterSessions')}</Text>
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
            <Text style={styles.more}>{t('home.moreStudiedChapters', { value: studiedAnalytics.length - visibleRows.length })}</Text>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    color: colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 17, marginTop: 3, flexShrink: 1 },
  row: { marginTop: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  nameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  name: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: FontSize.sm, lineHeight: 18, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  minutes: { maxWidth: '30%', color: colors.textPrimary, fontSize: FontSize.sm, lineHeight: 18, fontWeight: FontWeight.bold, textAlign: 'right', flexShrink: 1 },
  barBackground: { height: 7, marginTop: 7, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.full },
  meta: { color: colors.textTertiary, fontSize: FontSize.xs, lineHeight: 17, marginTop: 4, flexShrink: 1 },
  empty: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19, paddingVertical: Spacing.sm, flexShrink: 1 },
  more: { color: colors.primary, fontSize: FontSize.xs, lineHeight: 17, fontWeight: FontWeight.semiBold, marginTop: Spacing.md, flexShrink: 1 },
});
