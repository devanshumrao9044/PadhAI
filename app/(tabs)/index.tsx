import { useEffect, useState, useCallback, useRef } from 'react';
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
import SideDrawer from '../../components/ui/SideDrawer';

export default function Dashboard() {
  const [userName, setUserName] = useState('Student');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [chaptersTotal, setChaptersTotal] = useState(0);
  const [chaptersDone, setChaptersDone] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function loadUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('users')
        .select('name, streak, daily_goal_minutes, xp, my_referral_code')
        .eq('id', user.id)
        .single();
      if (data) {
        setUserName(data.name || 'Student');
        setStreak(data.streak || 0);
        setXpTotal(data.xp || 0);
        setUserCode(data.my_referral_code || null);
      }
      setUserId(user.id);
    } catch (e) {
      console.log('User data error:', e);
    }
  }

  async function loadChaptersStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('chapters')
        .select('status, is_deleted')
        .eq('user_id', user.id)
        .eq('is_deleted', false);
      if (data) {
        setChaptersTotal(data.length);
        setChaptersDone(data.filter((c: any) => c.status === 'done').length);
      }
    } catch (e) {
      console.log('Chapters error:', e);
    }
  }

  async function loadTodayStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('focus_sessions')
        .select('actual_minutes')
        .eq('user_id', user.id)
        .eq('broken', false)
        .gte('started_at', today.toISOString());
      if (data) {
        const total = data.reduce(
          (sum: number, s: any) => sum + (s.actual_minutes || 0), 0
        );
        setTodayMinutes(total);
      }
    } catch (e) {
      console.log('Stats error:', e);
    }
  }

  async function loadAll() {
    await Promise.all([loadUserData(), loadTodayStats(), loadChaptersStats()]);
  }

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`dashboard-${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        () => { loadTodayStats(); loadUserData(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chapters', filter: `user_id=eq.${userId}` },
        () => loadChaptersStats()
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }, []);

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
            tintColor="#7C5CFC"
            colors={['#7C5CFC']}
            progressBackgroundColor="#1C1C1E"
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

        <GreetingCard name={userName} streak={streak} />
        <StatsRow
          todayMins={todayMinutes}
          xp={xpTotal}
          chaptersTotal={chaptersTotal}
          chaptersDone={chaptersDone}
        />
        <QuickShortcuts />
        <QuoteCard />
      </ScrollView>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={userName}
        userCode={userCode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
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
  appName: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  ai: { color: '#7C5CFC' },
  date: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
});
