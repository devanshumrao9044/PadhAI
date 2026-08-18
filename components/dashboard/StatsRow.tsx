import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';

interface Props {
  todayMins?: number;
  xp?: number;
  chaptersTotal?: number;
  chaptersDone?: number;
}

export default function StatsRow({ todayMins = 0, xp = 0, chaptersTotal = 0, chaptersDone = 0 }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <Text style={styles.value}>{hours}{t('common.hoursShort')} {minutes}{t('common.minutesShort')}</Text>
          <Text style={styles.label}>{t('home.todayFocus')}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={[styles.value, { color: colors.warning }]}>{xp || user?.xpTotal || 0}</Text>
          <Text style={styles.label}>{t('home.weeklyXP')}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.emoji}>📚</Text>
          <Text style={styles.value}>{chaptersDone}/{chaptersTotal}</Text>
          <Text style={styles.label}>{t('home.chapters')}</Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>{t('home.dailyGoalProgress')}</Text>
          <Text style={styles.progressText}>{todayMinutes} / {goalMinutes} {t('common.minutesShort')}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` as any, backgroundColor: percent >= 100 ? colors.success : colors.primary }]} />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emoji: { fontSize: 22, marginBottom: 6 },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  label: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  progressContainer: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  progressText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: colors.surfaceVariant, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
});
