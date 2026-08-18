import React, { useMemo, useState } from 'react';
import {
  Modal, Pressable, View, Text, StyleSheet, TouchableOpacity, Share,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import type { DailySummary } from '@/types/models';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentStreak: number;
  bestStreak: number;
  todayMinutes: number;
  dailyGoalMinutes: number;
  dailySummaries: DailySummary[];
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function StreakOverviewModal({
  visible,
  onClose,
  currentStreak,
  bestStreak,
  todayMinutes,
  dailyGoalMinutes,
  dailySummaries,
}: Props) {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showExplanation, setShowExplanation] = useState(false);
  const todayKey = dateKey(new Date());
  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const key = dateKey(day);
      const summary = dailySummaries.find(item => item.date === key);
      const minutes = key === todayKey ? Math.max(todayMinutes, summary?.totalMinutes ?? 0) : (summary?.totalMinutes ?? 0);
      return {
        key,
        day,
        minutes,
        active: minutes > 0,
        isToday: key === todayKey,
      };
    });
  }, [dailySummaries, todayKey, todayMinutes]);

  const goal = Math.max(1, dailyGoalMinutes);
  const goalProgress = Math.min(todayMinutes / goal, 1);

  const handleShare = async () => {
    await Share.share({
      message: t('home.streakShareMessage', { value: currentStreak }),
      title: t('home.streakShareTitle'),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>{t('home.streakOverview')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel={t('common.close')}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.flameCircle}>
              <MaterialIcons name="local-fire-department" size={52} color={colors.warning} />
              <Text style={styles.streakNumber}>{currentStreak}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('home.daysStreak')}</Text>
            <Text style={styles.heroSubtitle}>{t('home.bestStreakValue', { value: bestStreak })}</Text>
          </View>

          <View style={styles.weekCard}>
            <Text style={styles.sectionTitle}>{t('home.weeklyStreak')}</Text>
            <View style={styles.weekRow}>
              {weekDays.map(item => (
                <View key={item.key} style={styles.dayColumn}>
                  <Text style={[styles.dayLabel, item.isToday && { color: colors.primary }]}>
                    {item.day.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short' }).slice(0, 3)}
                  </Text>
                  <View style={[styles.dayCircle, item.active && styles.dayCircleActive, item.isToday && styles.dayCircleToday]}>
                    {item.active ? <MaterialIcons name="check" size={16} color={colors.background} /> : <Text style={styles.dayEmpty}>·</Text>}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>{t('home.todayProgress')}</Text>
              <Text style={styles.progressValue}>{todayMinutes}/{goal} {t('common.minutesShort')}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${goalProgress * 100}%` as any }]} />
            </View>
          </View>

          {showExplanation ? (
            <View style={styles.explanationCard}>
              <MaterialIcons name="local-fire-department" size={20} color={colors.warning} />
              <Text style={styles.explanationText}>{t('home.streakExplanation')}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleShare} activeOpacity={0.85}>
              <MaterialIcons name="share" size={18} color={colors.background} />
              <Text style={styles.primaryButtonText}>{t('home.shareAchievement')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowExplanation(value => !value)} activeOpacity={0.8}>
              <MaterialIcons name="help-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>{t('home.whatsAStreak')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: colors.borderStrong,
    marginBottom: Spacing.sm,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.extraBold },
  closeButton: { padding: 6 },
  hero: { alignItems: 'center', paddingVertical: Spacing.md },
  flameCircle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning + '22',
    borderWidth: 2,
    borderColor: colors.warning + '66',
  },
  streakNumber: { color: colors.warning, fontSize: 30, fontWeight: FontWeight.extraBold, marginTop: -6 },
  heroTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.sm },
  heroSubtitle: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  weekCard: { backgroundColor: colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  dayColumn: { alignItems: 'center', gap: 6 },
  dayLabel: { color: colors.textTertiary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dayCircleActive: { backgroundColor: colors.success, borderColor: colors.success },
  dayCircleToday: { borderWidth: 2, borderColor: colors.primary },
  dayEmpty: { color: colors.textTertiary, fontSize: FontSize.lg },
  progressCard: { backgroundColor: colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressValue: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  progressTrack: { height: 9, borderRadius: Radius.full, backgroundColor: colors.border, overflow: 'hidden', marginTop: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.warning, borderRadius: Radius.full },
  explanationCard: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: colors.warning + '12', borderRadius: Radius.md, borderWidth: 1, borderColor: colors.warning + '44', padding: Spacing.sm, marginBottom: Spacing.sm },
  explanationText: { flex: 1, color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  primaryButton: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 13 },
  primaryButtonText: { color: colors.background, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  secondaryButton: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingVertical: 12 },
  secondaryButtonText: { color: colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
});
