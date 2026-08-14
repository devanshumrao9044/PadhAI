import React, { useEffect, useRef, useState, useContext } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, AppContext } from '@/contexts/AppContext';
import { supabase } from '@/services/supabase';
import { View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';

// ─── NavigationGuard lives INSIDE the Stack so router hooks are always valid ───
function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const appCtx = useContext(AppContext);

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const bootRedirectDone = useRef(false);
  const coldStartHasSession = useRef(false);
  // Defer all router calls until after the first paint so the nav container
  // is fully initialised on Android/Hermes before we touch it.
  const navReady = useRef(false);

  const isProtected =
    routeSegments[0] === '(tabs)' ||
    routeSegments[0] === 'onboarding' ||
    routeSegments[0] === 'focus' ||
    routeSegments[0] === 'tracker' ||
    routeSegments[0] === 'streak-broken' ||
    routeSegments[0] === 'referral';

  // ── 1. Mark nav as ready + initialise auth ──────────────────────────────
  useEffect(() => {
    navReady.current = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) coldStartHasSession.current = true;
      setSession(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (_event === 'SIGNED_OUT') {
        bootRedirectDone.current = false;
        coldStartHasSession.current = false;
        // Navigate to login directly — no state batching delay needed
        setTimeout(() => {
          try { router.replace('/'); } catch { /* ignore */ }
        }, 0);
      }
      setSession(s);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Guard: kick unauthenticated users off protected routes ─────────────
  useEffect(() => {
    if (!navReady.current) return;
    if (session === undefined) return; // still initialising
    if (!session && isProtected) {
      router.replace('/');
    }
  }, [session, isProtected, router]);

  // ── 3. Cold-start redirect: streak check + profile check ─────────────────
  useEffect(() => {
    if (!navReady.current) return;
    if (session === undefined) return;

    const onIndex = routeSegments.length === 0;
    if (session && onIndex && !bootRedirectDone.current && coldStartHasSession.current) {
      bootRedirectDone.current = true;
      const uid = session.user.id;

      (async () => {
        // Streak guard
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('streak, last_study_date')
            .eq('id', uid)
            .single();

          if (profile && profile.streak > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const lastStudy = profile.last_study_date
              ? new Date(profile.last_study_date)
              : null;
            if (lastStudy) lastStudy.setHours(0, 0, 0, 0);

            if (!lastStudy || lastStudy < yesterday) {
              await supabase.from('users').update({ streak: 0 }).eq('id', uid);
              appCtx?.setComebackPending(true);
              router.replace({
                pathname: '/streak-broken',
                params: { lost: profile.streak },
              });
              return;
            }
          }
        } catch (err) {
          console.log('Streak guard error:', err);
        }

        // Profile check → onboarding or home
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('name')
            .eq('id', uid)
            .single();
          if (!profile?.name || profile.name === 'Student') {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        } catch {
          router.replace('/(tabs)');
        }
      })();
    }
  }, [session, routeSegments, appCtx, router]);

  // This component renders nothing — it's a pure side-effect component
  return null;
}

// ─── Splash / initialising screen (shown while getSession resolves) ───────────
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

// ─── Root layout ─────────────────────────────────────────────────────────────
export default function RootLayout() {
  // Minimal session check just to show splash until auth is resolved.
  // NavigationGuard (inside the Stack) does the actual routing.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0F' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="streak-broken"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="focus/active"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen
            name="focus/complete"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="focus/levelup"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="focus/broken"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="referral"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="tracker/[subjectId]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="tracker/chapters/[chapterId]"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
        {/* Guard lives inside the navigator tree so useRouter/useSegments
            are always called with a valid navigation store */}
        <NavigationGuard />
      </AppProvider>
    </SafeAreaProvider>
  );
}
