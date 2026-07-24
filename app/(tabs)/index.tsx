import { useState, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  RefreshControl, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../hooks/useApp'; // ✅ Global state import kiya
import GreetingCard from '../../components/dashboard/GreetingCard';
import StatsRow from '../../components/dashboard/StatsRow';
import QuickShortcuts from '../../components/dashboard/QuickShortcuts';
import QuoteCard from '../../components/dashboard/QuoteCard';
import SideDrawer from '../../components/ui/SideDrawer';

export default function Dashboard() {
  // ✅ Seedha AppContext se data uthaya (no separate Supabase queries needed)
  const { user, chapters, sessions, reload } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ✅ Synchronously calculations (instant UI update)
  const userName = user?.fullName || 'Student';
  const streak = user?.streakCurrent || 0;
  const xpTotal = user?.xpTotal || 0;

  const activeChapters = chapters.filter(c => !c.isDeleted);
  const chaptersTotal = activeChapters.length;
  const chaptersDone = activeChapters.filter(c => c.status === 'done').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMinutes = sessions
    .filter(s => s.sessionDate === todayStr && s.completed)
    .reduce((sum, s) => sum + (s.durationActualMins || 0), 0);

  // ✅ Pull-to-refresh ab global state ko reload karega
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
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

      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
