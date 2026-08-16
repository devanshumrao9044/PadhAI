import 'react-native-web';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '../../services/supabase';
import GreetingCard from '../../components/dashboard/GreetingCard';
import StatsRow from '../../components/dashboard/StatsRow';
import QuickShortcuts from '../../components/dashboard/QuickShortcuts';
import QuoteCard from '../../components/dashboard/QuoteCard';
import ChapterAnalyticsCard from '../../components/dashboard/ChapterAnalyticsCard';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, chapters, sessions, dailySummaries, chapterAnalytics, reload } = useApp();
  const [refreshing, setRefreshing] = useState(false);
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
    if (!userId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelIdRef.current += 1;
    const channel = supabase
      .channel(`dashboard-web-${userId}-${channelIdRef.current}`)
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
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [scheduleReload, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
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
        <View style={styles.header}>
          <Text style={styles.appName}>
            पढ़<Text style={styles.ai}>AI</Text>
          </Text>

          {/* Header Right Actions */}
          <View style={styles.headerRight}>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short'
              })}
            </Text>

            <TouchableOpacity
              style={styles.referralBtn}
              onPress={() => router.push('/referral')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="card-giftcard" size={22} color={colors.primary} />
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
        <ChapterAnalyticsCard analytics={chapterAnalytics} />
        <QuickShortcuts />
        <QuoteCard />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    minHeight: '100vh' as any,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 56,
    paddingBottom: 120,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
  ai: { color: '#A855F7' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  date: { color: colors.textTertiary, fontSize: 14, fontWeight: '500' },
  referralBtn: {
    backgroundColor: colors.primary + '1F',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '4D',
  },
});

