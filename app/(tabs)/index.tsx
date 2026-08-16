import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  RefreshControl, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import GreetingCard from '../../components/dashboard/GreetingCard';
import StatsRow from '../../components/dashboard/StatsRow';
import QuickShortcuts from '../../components/dashboard/QuickShortcuts';
import QuoteCard from '../../components/dashboard/QuoteCard';
import ChapterAnalyticsCard from '../../components/dashboard/ChapterAnalyticsCard';
import SideDrawer from '../../components/ui/SideDrawer';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function Dashboard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, chapters, sessions, dailySummaries, chapterAnalytics, reload } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelIdRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;

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
      void reload();
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
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

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

          <Text style={styles.appName}>
            पढ़<Text style={styles.ai}>AI</Text>
          </Text>

          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short', day: 'numeric', month: 'short'
            })}
          </Text>
        </View>

        <GreetingCard name={user?.fullName || 'Student'} streak={user?.streakCurrent || 0} />
        <StatsRow
          todayMins={stats.todayMinutes}
          xp={user?.xpTotal || 0}
          chaptersTotal={stats.chaptersTotal}
          chaptersDone={stats.chaptersDone}
        />
        <ChapterAnalyticsCard analytics={chapterAnalytics} />
        <QuickShortcuts />
        <QuoteCard />
      </ScrollView>

      {/*  FIX: Removed unnecessary props from SideDrawer */}
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
  appName: { fontSize: 26, fontWeight: '900', color: colors.textPrimary },
  ai: { color: colors.primary },
  date: { color: colors.textTertiary, fontSize: 13, fontWeight: '500' },
});
