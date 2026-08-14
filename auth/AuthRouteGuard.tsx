import { useContext, useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { AppContext } from '@/contexts/AppContext';
import { supabase } from '@/services/supabase';
import { useAuthSession } from './AuthSessionProvider';

export default function AuthRouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const { session, ready } = useAuthSession();
  const appContext = useContext(AppContext);
  const redirectingOut = useRef(false);
  const checkedSessionId = useRef<string | null>(null);

  const isProtected =
    routeSegments[0] === '(tabs)' ||
    routeSegments[0] === 'onboarding' ||
    routeSegments[0] === 'focus' ||
    routeSegments[0] === 'tracker' ||
    routeSegments[0] === 'streak-broken' ||
    routeSegments[0] === 'referral';

  useEffect(() => {
    if (!ready) return;
    if (session) {
      redirectingOut.current = false;
      return;
    }
    if (!isProtected || redirectingOut.current) return;

    redirectingOut.current = true;
    const timer = setTimeout(() => {
      try {
        router.replace('/');
      } catch {
        redirectingOut.current = false;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isProtected, ready, router, session]);

  useEffect(() => {
    if (!ready || !session || routeSegments.length !== 0 || checkedSessionId.current === session.user.id) return;

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
        router.replace(!profile?.name || profile.name === 'Student' ? '/onboarding' : '/(tabs)');
      } catch {
        if (!cancelled) router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appContext, ready, routeSegments, router, session]);

  return null;
}
