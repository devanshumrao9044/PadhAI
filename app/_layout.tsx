import React, { useContext, useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, AppContext } from '@/contexts/AppContext';
import { supabase } from '@/services/supabase';
import { View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';

// NavigationGuard is rendered beside the root Stack, not around it. This means
// Expo Router has already installed its navigation context before the guard
// calls useRouter/useSegments or attempts a logout redirect.
function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const appCtx = useContext(AppContext);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const navReady = useRef(false);
  const redirectPending = useRef(false);
  const bootRedirectDone = useRef(false);
  const coldStartHasSession = useRef(false);

  const isProtected =
    routeSegments[0] === '(tabs)' ||
    routeSegments[0] === 'onboarding' ||
    routeSegments[0] === 'focus' ||
    routeSegments[0] === 'tracker' ||
    routeSegments[0] === 'streak-broken' ||
    routeSegments[0] === 'referral';

  useEffect(() => {
    // This effect only runs after the Stack and its navigation context mount.
    navReady.current = true;

    supabase.auth.getSession().then(({ data: { session: savedSession } }) => {
      if (savedSession) coldStartHasSession.current = true;
      setSession(savedSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        bootRedirectDone.current = false;
        coldStartHasSession.current = false;
      }
      setSession(nextSession);
    });

    return () => {
      navReady.current = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      redirectPending.current = false;
      return;
    }
    if (!navReady.current || session === undefined || !isProtected || redirectPending.current) {
      return;
    }

    redirectPending.current = true;
    const redirectTimer = setTimeout(() => {
      try {
        router.replace('/');
      } catch {
        // If native navigation is still completing a transaction, allow the
        // effect to retry on the next auth/segment update instead of crashing.
        redirectPending.current = false;
      }
    }, 50);

    return () => clearTimeout(redirectTimer);
  }, [isProtected, router, session]);

  useEffect(() => {
    if (!navReady.current || session === undefined) return;

    const onIndex = routeSegments.length === 0;
    if (!session || !onIndex || bootRedirectDone.current || !coldStartHasSession.current) return;

    let cancelled = false;
    bootRedirectDone.current = true;
    const uid = session.user.id;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('streak, last_study_date')
          .eq('id', uid)
          .single();

        if (cancelled) return;
        if (profile && profile.streak > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const lastStudy = profile.last_study_date ? new Date(profile.last_study_date) : null;
          if (lastStudy) lastStudy.setHours(0, 0, 0, 0);

          if (!lastStudy || lastStudy < yesterday) {
            await supabase.from('users').update({ streak: 0 }).eq('id', uid);
            if (cancelled) return;
            appCtx?.setComebackPending(true);
            router.replace({ pathname: '/streak-broken', params: { lost: profile.streak } });
            return;
          }
        }
      } catch (error) {
        console.log('Streak guard error:', error);
      }

      if (cancelled) return;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', uid)
          .single();
        if (cancelled) return;
        router.replace(!profile?.name || profile.name === 'Student' ? '/onboarding' : '/(tabs)');
      } catch {
        if (!cancelled) router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appCtx, routeSegments, router, session]);

  return null;
}

function SplashScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="large" color="#6B21A8" />
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().finally(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
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
        <NavigationGuard />
      </AppProvider>
    </SafeAreaProvider>
  );
}
