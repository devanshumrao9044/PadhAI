import { useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { AppContext } from '@/contexts/AppContext';
import { supabase } from '@/features/core/services/supabase';
import { useAuthSession } from './AuthSessionProvider';

export default function AuthRouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const [navigationReady, setNavigationReady] = useState(false);
  const { session, ready } = useAuthSession();
  const appContext = useContext(AppContext);
  const appUser = appContext?.user ?? null;
  const appIsOnboarded = appContext?.isOnboarded ?? false;
  const appLoading = appContext?.isLoading ?? true;
  const redirectingOut = useRef(false);
  const checkedSessionId = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setNavigationReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const isProtected =
    routeSegments[0] === '(tabs)' ||
    routeSegments[0] === 'onboarding' ||
    routeSegments[0] === 'focus' ||
    routeSegments[0] === 'tracker' ||
    routeSegments[0] === 'streak-broken' ||
    routeSegments[0] === 'referral' ||
    routeSegments[0] === 'todo' ||
    routeSegments[0] === 'calendar' ||
    routeSegments[0] === 'notifications' ||
    routeSegments[0] === 'study-groups' ||
    routeSegments[0] === 'raise-ticket' ||
    routeSegments[0] === 'review-tickets' ||
    routeSegments[0] === 'admin' ||
    routeSegments[0] === 'first-time-help';
  const isSessionAllowedPublicRoute =
    routeSegments[0] === 'privacy-policy' ||
    routeSegments[0] === 'reset-password';

  useEffect(() => {
    if (!ready || !navigationReady || appLoading) return;
    if (session && session.user.email && !session.user.email_confirmed_at) {
      if (redirectingOut.current) return;
      redirectingOut.current = true;
      void supabase.auth.signOut().finally(() => {
        redirectingOut.current = false;
        router.replace('/login' as Parameters<typeof router.replace>[0]);
      });
      return;
    }
    if (session) {
      redirectingOut.current = false;
      return;
    }
    if (!isProtected || redirectingOut.current) return;

    redirectingOut.current = true;
    const timer = setTimeout(() => {
      try {
        router.replace('/login' as Parameters<typeof router.replace>[0]);
      } catch {
        redirectingOut.current = false;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [appLoading, isProtected, navigationReady, ready, router, session]);

  useEffect(() => {
    if (!ready || !navigationReady || appLoading) return;
    if (!session) {
      checkedSessionId.current = null;
      return;
    }
    const sessionRouteKey = `${session.user.id}:${appIsOnboarded ? 'complete' : 'setup'}`;
    if (isProtected || isSessionAllowedPublicRoute || checkedSessionId.current === sessionRouteKey) return;

    checkedSessionId.current = sessionRouteKey;
    let cancelled = false;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];
    const userId = session.user.id;
    const profile = appUser;

    (async () => {
      try {
        if (profile && profile.streakCurrent > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const lastStudy = profile.lastStudyDate ? new Date(profile.lastStudyDate) : null;
          if (lastStudy) lastStudy.setHours(0, 0, 0, 0);

          if (!lastStudy || lastStudy < yesterday) {
            const { data } = await supabase.rpc('mark_streak_broken');
            if (cancelled) return;
            if (data?.broken) {
              const lostStreak = Number(data.lost_streak ?? profile.streakCurrent);
              appContext?.setComebackPending(true);
              router.replace({ pathname: '/streak-broken', params: { lost: lostStreak } });
              return;
            }
          }
        }

        if (cancelled) return;
        const landingRoute = appIsOnboarded ? '/(tabs)' : '/onboarding';
        router.replace(landingRoute);
        if (cancelled) return;
        // On web and some native startup frames the first replace can be
        // ignored while the root navigator is committing its state. Retry a
        // few times, cancelling all retries if auth or the route changes.
        [150, 350, 700].forEach((delay) => {
          retryTimers.push(setTimeout(() => {
            if (!cancelled && !isProtected) router.replace(landingRoute);
          }, delay));
        });
      } catch {
        if (!cancelled) router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
      retryTimers.forEach(timer => clearTimeout(timer));
    };
  }, [appContext, appIsOnboarded, appLoading, appUser, isProtected, isSessionAllowedPublicRoute, navigationReady, ready, router, session]);

  return null;
}
