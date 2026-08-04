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
  const appCtx = useContext(AppContext);
  // Track whether we have already performed the post-boot redirect so we only
  // do it once (on cold-start when the user already has a valid session).
  const bootRedirectDone = useRef(false);
  // Only true when getSession() itself found a session on mount (genuine cold-start).
  // Fresh logins via index.tsx keep this false so the AuthGate does NOT compete.
  const coldStartHasSession = useRef(false);

  // ── 1. Initialise session once on mount ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) coldStartHasSession.current = true; // existing session on app open
      setSession(s);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (_event === 'SIGNED_OUT') {
        bootRedirectDone.current = false;
        coldStartHasSession.current = false;
        // Fire the redirect immediately — do not rely on the segments effect
        // which only runs after React re-renders (too slow / unreliable).
        setTimeout(() => {
          try { router.dismissAll(); } catch (_) {}
          router.replace('/');
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Guard: kick unauthenticated users off protected routes ─────────────
  //    This is the ONLY place that fires router.replace('/') on sign-out.
  //    Post-login redirects are handled by app/index.tsx itself.
  useEffect(() => {
    if (checking) return;

    const isProtected =
      segments[0] === '(tabs)'      ||
      segments[0] === 'onboarding'  ||
      segments[0] === 'focus'       ||
      segments[0] === 'tracker'     ||
      segments[0] === 'streak-broken' ||
      segments[0] === 'referral';

    if (!session && isProtected) {
      // Safety-net only (e.g. deep-link to protected route while logged out).
      // Normal logout is already handled directly in the SIGNED_OUT event above.
      try { router.dismissAll(); } catch (_) {}
      router.replace('/');
      return;
    }

    // Cold-start: session already exists and we are on the root index.
    // Run the streak check + profile check exactly once so the user lands
    // on the correct screen without the login page doing a double redirect.
    // coldStartHasSession guards against running this on fresh login (index.tsx
    // handles post-login redirects itself).
    const onIndex = segments.length === 0 || segments[0] === 'index';
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
            const lastStudy = profile.last_study_date ? new Date(profile.last_study_date) : null;
            if (lastStudy) lastStudy.setHours(0, 0, 0, 0);

            if (!lastStudy || lastStudy < yesterday) {
              await supabase.from('users').update({ streak: 0 }).eq('id', uid);
              appCtx?.setComebackPending(true);
              router.replace({ pathname: '/streak-broken', params: { lost: profile.streak } });
              return;
            }
          }
        } catch (err) {
          console.log('Streak guard error:', err);
        }

        // Profile check → onboarding or home
        try {
          const { data: profile } = await supabase
            .from('users').select('name').eq('id', uid).single();
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
  }, [session, segments, checking]);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6B21A8" />
      </View>
    );
  }

  return <>{children}</>
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
