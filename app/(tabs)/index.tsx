import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  RefreshControl, TouchableOpacity
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/features/core/services/supabase';
import GreetingCard from '../../components/dashboard/GreetingCard';
import StatsRow from '../../components/dashboard/StatsRow';
import QuickShortcuts from '../../components/dashboard/QuickShortcuts';
import QuoteCard from '../../components/dashboard/QuoteCard';
import ChapterAnalyticsCard from '../../components/dashboard/ChapterAnalyticsCard';
import SideDrawer from '../../components/ui/SideDrawer';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import StreakOverviewModal from '@/components/ui/StreakOverviewModal';
import { loadUnreadNotificationCount } from '@/features/notifications/services/adminNotifications';

export default function Dashboard() {
  const { colors } = useTheme();
  const { language, t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user, isLoading, subjects, chapters, sessions, dailySummaries, chapterAnalytics, reload } = useApp();
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const activeChapterIds = useMemo(() => {
    const activeSubjectIds = new Set(subjects.filter(subject => !subject.isDeleted).map(subject => subject.id));
    return new Set(chapters
      .filter(chapter => !chapter.isDeleted && activeSubjectIds.has(chapter.subjectId))
      .map(chapter => chapter.id));
  }, [chapters, subjects]);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelIdRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (userId) {
      void loadUnreadNotificationCount().then(count => {
        if (active) setUnreadNotifications(count);
      }).catch(() => { if (active) setUnreadNotifications(0); });
    } else {
      setUnreadNotifications(0);
    }
    return () => { active = false; };
  }, [userId]));

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMinutes = dailySummaries.find(summary => summary.date === today)?.totalMinutes
      ?? sessions.filter(session => session.completed && session.sessionDate === today)
        .reduce((sum, session) => sum + session.durationActualMins, 0);
    const activeChapters = chapters.filter(chapter => !chapter.isDeleted);
    return {
      todayMinutes,
      chaptersTotal: activeChapters.length,
      chaptersDone: activeChapters.filter(chapter => chapter.status === 'done').length,
    };
  }, [chapters, dailySummaries, sessions]);

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

  useEffect(() => {
    if (!userId) setDrawerOpen(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void reload();
  }, [reload, userId]);

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelIdRef.current += 1;
    const channel = supabase
      .channel(`dashboard-${userId}-${channelIdRef.current}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        scheduleReload,
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${userId}` },
        scheduleReload,
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [scheduleReload, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload({ force: true }); } finally { setRefreshing(false); }
  }, [reload]);

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 80 }}>
          Loading your profile…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceVariant}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.menuBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 18 }]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>

          <View style={styles.headerTitleBlock}>
            <Text style={styles.appName}>
              {language === 'hi' ? 'पढ़' : 'Padh'}<Text style={styles.ai}>AI</Text>
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
                weekday: 'short', day: 'numeric', month: 'short'
              })}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.notificationHeaderButton} onPress={() => router.push('/notifications' as Parameters<typeof router.push>[0])} accessibilityLabel={t('notifications.title')}>
              <MaterialIcons name="notifications" size={21} color={colors.primary} />
              {unreadNotifications > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerStat} onPress={() => setStreakModalOpen(true)} accessibilityLabel={t('home.streakOverview')}>
              <MaterialIcons name="local-fire-department" size={17} color={colors.warning} />
              <Text style={[styles.headerStatText, { color: colors.warning }]}>{user.streakCurrent}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push('/rewards' as Parameters<typeof router.push>[0])} accessibilityLabel={t('rewards.title')}>
              <MaterialIcons name="card-giftcard" size={21} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerStat} onPress={() => router.push('/(tabs)/leaderboard')} accessibilityLabel={t('home.leaderboard')}>
              <MaterialIcons name="bolt" size={17} color={colors.primary} />
              <Text style={[styles.headerStatText, { color: colors.primary }]}>{user.xpTotal}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <GreetingCard name={user?.fullName || 'Student'} streak={user?.streakCurrent || 0} />
        <StatsRow
          todayMins={stats.todayMinutes}
          xp={user?.xpTotal || 0}
          chaptersTotal={stats.chaptersTotal}
          chaptersDone={stats.chaptersDone}
        />
        <ChapterAnalyticsCard analytics={chapterAnalytics} activeChapterIds={activeChapterIds} />
        <QuickShortcuts />
        <QuoteCard />
      </ScrollView>

      {/*  FIX: Removed unnecessary props from SideDrawer */}
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <StreakOverviewModal
        visible={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        currentStreak={user.streakCurrent}
        bestStreak={user.streakLongest}
        todayMinutes={stats.todayMinutes}
        dailyGoalMinutes={user.dailyGoalMinutes}
        dailySummaries={dailySummaries}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 20, paddingTop: 16, paddingBottom: 120 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  menuBtn: { gap: 5, padding: 4 },
  menuLine: {
    width: 22, height: 2,
    backgroundColor: '#9CA3AF', borderRadius: 2,
  },
  headerTitleBlock: { flex: 1, minWidth: 0, marginLeft: 8 },
  appName: { fontSize: 26, lineHeight: 32, fontWeight: '900', color: colors.textPrimary, flexShrink: 1 },
  ai: { color: colors.primary },
  date: { color: colors.textTertiary, fontSize: 11, lineHeight: 16, fontWeight: '500', marginTop: 2, flexShrink: 1 },
  headerActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerStat: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.surfaceVariant },
  headerStatText: { fontSize: 12, fontWeight: '800', maxWidth: 52 },
  headerIconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceVariant },
  notificationHeaderButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceVariant, position: 'relative' },
  notificationBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.background },
  notificationBadgeText: { color: colors.background, fontSize: 9, fontWeight: '800' },
});
