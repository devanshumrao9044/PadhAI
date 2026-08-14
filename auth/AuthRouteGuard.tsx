import { useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { AppContext } from '@/contexts/AppContext';
import { supabase } from '@/services/supabase';
import { useAuthSession } from './AuthSessionProvider';

export default function AuthRouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const [navigationReady, setNavigationReady] = useState(false);
  const { session, ready } = useAuthSession();
  const appContext = useContext(AppContext);
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
    routeSegments[0] === 'referral';

  useEffect(() => {
    if (!ready || !navigationReady) return;
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
  }, [isProtected, navigationReady, ready, router, session]);

  useEffect(() => {
    if (!ready || !navigationReady) return;
    if (!session) {
      checkedSessionId.current = null;
      return;
    }
    if (isProtected || checkedSessionId.current === session.user.id) return;

    checkedSessionId.current = session.user.id;
    let cancelled = false;
    const userId = session.user.id;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('name, streak, last_study_date')
          .eq('id', userId)
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
            await supabase.from('users').update({ streak: 0 }).eq('id', userId);
            if (cancelled) return;
            appContext?.setComebackPending(true);
            router.replace({ pathname: '/streak-broken', params: { lost: profile.streak } });
            return;
          }
        }

        if (cancelled) return;
        const landingRoute = !profile?.name || profile.name === 'Student' ? '/onboarding' : '/(tabs)';
        router.replace(landingRoute);
        // On web and some native startup frames the first replace can be
        // ignored while the root navigator is committing its state. Retry a
        // few times, cancelling all retries if auth or the route changes.
        [150, 350, 700].forEach((delay) => {
          setTimeout(() => {
            if (!cancelled && !isProtected) router.replace(landingRoute);
          }, delay);
        });
      } catch {
        if (!cancelled) router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appContext, isProtected, navigationReady, ready, router, session]);

  return null;
}
