import React, { useEffect, useRef, useState, useContext } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, AppContext } from '@/contexts/AppContext';
import { supabase } from '@/services/supabase';
import { View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// All segments that require an authenticated session.
// Add any new protected route names here.
// ─────────────────────────────────────────────────────────────────────────────
const PROTECTED_SEGMENTS = new Set([
  '(tabs)',
  'onboarding',
  'focus',
  'tracker',
  'streak-broken',
  'referral',
]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const appCtx = useContext(AppContext);

  // undefined = initial load (session not yet resolved — show spinner)
  // null      = confirmed no session
  // Session   = confirmed active session
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const streakCheckedRef = useRef(false);

  // ── 1. Auth listener — ONLY updates state, never navigates ───────────────
  useEffect(() => {
    // Resolve the current session on cold start
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (_event === 'SIGNED_OUT') {
        // Reset so the streak check runs again on next login
        streakCheckedRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Routing — the ONLY place that calls router.replace ────────────────
  useEffect(() => {
    // Still waiting for Supabase to resolve the initial session — don't route yet
    if (session === undefined) return;

    const currentSegment = segments[0] as string | undefined;
    const onAuthScreen = !currentSegment || currentSegment === 'index';
    const onProtectedScreen = PROTECTED_SEGMENTS.has(currentSegment ?? '');

    // ── Sign-out / expired session: kick off protected screens ──────────────
    if (!session) {
      if (onProtectedScreen) {
        router.replace('/');
      }
      return;
    }

    // ── Authenticated: run the one-time startup check ────────────────────────
    if (!streakCheckedRef.current) {
      streakCheckedRef.current = true; // Set immediately — prevents re-entry on re-renders

      const uid = session.user.id;

      if (onAuthScreen) {
        // User is on the root/login screen — check streak then route
        (async () => {
          const streakRedirected = await checkStreakOnLaunch(uid);
          // Only proceed to onboarding/tabs if streak check didn't already redirect
          if (!streakRedirected) {
            await checkAndRedirect(uid);
          }
        })();
      } else {
        // User is already on a protected screen (resumed from background, etc.)
        // Run the streak check but don't force a redirect to onboarding/tabs
        checkStreakOnLaunch(uid).catch((err) =>
          console.log('[AuthGate] Background streak check failed:', err)
        );
      }
    }
  }, [session, segments]);

  // ── Streak guard — returns true if it redirected ─────────────────────────
  const checkStreakOnLaunch = async (userId: string): Promise<boolean> => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('streak, last_study_date')
        .eq('id', userId)
        .single();

      if (!profile || profile.streak <= 0) return false;

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
        router.replace({
          pathname: '/streak-broken',
          params: { lost: profile.streak },
        });
        return true; // ← caller must check this before doing any further redirect
      }

      return false;
    } catch (err) {
      console.log('[AuthGate] Streak guard error:', err);
      return false;
    }
  };

  // ── Onboarding / main app redirect ───────────────────────────────────────
  const checkAndRedirect = async (userId: string): Promise<void> => {
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

  // ── Loading screen — shown until Supabase resolves the session ────────────
  if (session === undefined) {
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

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0A0A0F' },
            }}
          >
            <Stack.Screen name="index" />
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
        </AuthGate>
      </AppProvider>
    </SafeAreaProvider>
  );
}
