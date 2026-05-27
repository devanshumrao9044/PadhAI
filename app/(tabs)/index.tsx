import { useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, View,
  Text, StatusBar
} from 'react-native';
import { supabase } from '../../services/supabase';
import GreetingCard from '../../components/dashboard/GreetingCard';
import StatsRow from '../../components/dashboard/StatsRow';
import QuickShortcuts from '../../components/dashboard/QuickShortcuts';
import QuoteCard from '../../components/dashboard/QuoteCard';

export default function Dashboard() {
  const [userName, setUserName] = useState('Student');
  const [streak, setStreak] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [goalHours, setGoalHours] = useState(4);
  const [totalNotes, setTotalNotes] = useState(0);

  useEffect(() => {
    loadUserData();
    loadTodayStats();
  }, []);

  async function loadUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('users')
        .select('name, streak, daily_goal_hours, bookmarked_notes')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserName(data.name || 'Student');
        setStreak(data.streak || 0);
        setGoalHours(data.daily_goal_hours || 4);
        setTotalNotes(data.bookmarked_notes?.length || 0);
      }
    } catch (error) {
      console.log('User data error:', error);
    }
  }

  async function loadTodayStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('date', today.toISOString());

      if (data) {
        const total = data.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        setTodayMinutes(total);
      }
    } catch (error) {
      console.log('Stats error:', error);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>पढ़<Text style={styles.ai}>AI</Text></Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short', day: 'numeric', month: 'short'
            })}
          </Text>
        </View>

        <GreetingCard name={userName} streak={streak} />
        <StatsRow
          todayMinutes={todayMinutes}
          goalHours={goalHours}
          totalNotes={totalNotes}
        />
        <QuickShortcuts />
        <QuoteCard />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ai: {
    color: '#6B21A8',
  },
  date: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});
