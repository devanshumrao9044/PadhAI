import React, { useEffect, useRef, useState, useContext } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, AppContext } from '@/contexts/AppContext';
import { supabase } from '@/services/supabase';
import { View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [checking, setChecking] = useState(true);
  const streakCheckedRef = useRef(false);
  const appCtx = useContext(AppContext);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checking) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';
    const inFocus = segments[0] === 'focus';
    const inTracker = segments[0] === 'tracker';
    const inStreakBroken = segments[0] === 'streak-broken';
    const inReferral = segments[0] === 'referral';

    const isProtected = inAuthGroup || inOnboarding || inFocus || inTracker || inStreakBroken || inReferral;

    if (!session && isProtected) {
      router.replace('/');
    } else if (session && !streakCheckedRef.current) {
      streakCheckedRef.current = true;
      const uid = session.user.id;
      if (segments[0] === 'index' && !inAuthGroup) {
        (async () => {
          await checkStreakOnLaunch(uid);
          checkAndRedirect(uid);
        })();
      } else {
        checkStreakOnLaunch(uid);
      }
    }
  }, [session, segments, checking]);

  const checkStreakOnLaunch = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('streak, last_study_date')
        .eq('id', userId)
        .single();

      if (!profile || profile.streak <= 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const lastStudy = profile.last_study_date
        ? new Date(profile.last_study_date)
        : null;
      if (lastStudy) lastStudy.setHours(0, 0, 0, 0);

      const isBroken = !lastStudy || lastStudy < yesterday;

      if (isBroken) {
        await supabase.from('users').update({ streak: 0 }).eq('id', userId);
        appCtx?.setComebackPending(true);
        router.replace('/streak-broken');
      }
    } catch (err) {
      console.log('Streak guard error:', err);
    }
  };

  const checkAndRedirect = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (!profile?.name || profile.name === 'Student') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      router.replace('/(tabs)');
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6B21A8" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="streak-broken" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="focus/active" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="focus/complete" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="focus/levelup" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="focus/broken" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="referral" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="tracker/[subjectId]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="tracker/chapters/[chapterId]" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </AuthGate>
      </AppProvider>
    </SafeAreaProvider>
  );
}
