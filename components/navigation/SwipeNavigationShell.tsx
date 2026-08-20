import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { haptics } from '@/features/core/services/haptics';

const TAB_ROUTES = ['/(tabs)', '/(tabs)/focus', '/(tabs)/tracker', '/(tabs)/analytics', '/(tabs)/profile'] as const;
const TAB_SEGMENTS = ['index', 'focus', 'tracker', 'analytics', 'profile'] as const;
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 0.24;
const EDGE_BACK_WIDTH = 42;

type Props = { children: ReactNode };

function getTabIndex(segments: readonly string[]): number {
  if (segments[0] !== '(tabs)') return -1;
  const activeSegment = segments[1] ?? 'index';
  return TAB_SEGMENTS.indexOf(activeSegment as typeof TAB_SEGMENTS[number]);
}

export default function SwipeNavigationShell({ children }: Props) {
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const tabIndex = getTabIndex(segments);
  const isLockedScreen = ['focus', 'streak-broken', 'onboarding', 'reset-password'].includes(segments[0] ?? '');
  const gestureStartRef = useRef({ x: 0, y: 0 });

  const handleSwipe = useCallback((dx: number, dy: number, velocityX: number) => {
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) <= Math.abs(dy) * 1.35) return;
    if (Math.abs(velocityX) < SWIPE_VELOCITY && Math.abs(dx) < SWIPE_DISTANCE + 18) return;

    if (isLockedScreen) return;

    if (tabIndex >= 0) {
      const direction = dx < 0 ? 1 : -1;
      const nextIndex = tabIndex + direction;
      const nextRoute = TAB_ROUTES[nextIndex];
      if (!nextRoute) return;
      void haptics.tabSwitch();
      router.replace(nextRoute as Parameters<typeof router.replace>[0]);
      return;
    }

    // Stack screens use a deliberate edge swipe only, so regular horizontal
    // chips and carousels remain usable while browsing a detail route.
    if (dx > 0 && gestureStartRef.current.x <= EDGE_BACK_WIDTH) {
      void haptics.tabSwitch();
      router.back();
    }
  }, [isLockedScreen, router, tabIndex]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: event => {
      gestureStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      const horizontal = Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35;
      if (!horizontal) return false;
      const startedAtCorrectEdge = gesture.dx < 0
        ? gestureStartRef.current.x >= width - EDGE_BACK_WIDTH
        : gestureStartRef.current.x <= EDGE_BACK_WIDTH;
      return !isLockedScreen && startedAtCorrectEdge && (tabIndex >= 0 || gesture.dx > 0);
    },
    onPanResponderRelease: (_, gesture) => {
      handleSwipe(gesture.dx, gesture.dy, gesture.vx);
    },
    onPanResponderTerminate: () => {
      gestureStartRef.current = { x: 0, y: 0 };
    },
  }), [handleSwipe, isLockedScreen, tabIndex, width]);

  return <View style={styles.container} {...responder.panHandlers}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
