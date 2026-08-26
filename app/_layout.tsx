import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/contexts/AppContext';
import { AuthSessionProvider, useAuthSession } from '@/auth/AuthSessionProvider';
import AuthRouteGuard from '@/auth/AuthRouteGuard';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/hooks/useApp';
import SwipeNavigationShell from '@/components/navigation/SwipeNavigationShell';
import { configureNotificationHandler, loadNotificationSettings } from '@/features/notifications/services/localNotifications';
import { registerNotificationDevice } from '@/features/notifications/services/adminNotifications';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppNavigation() {
  const { mode, colors } = useTheme();
  const { ready: authReady } = useAuthSession();
  const { isLoading: appLoading, user } = useApp();
  const { ready: languageReady } = useLanguage();

  useEffect(() => {
    let active = true;
    if (!authReady || appLoading) return () => { active = false; };

    try {
      configureNotificationHandler();
    } catch {
      // Notification setup must never prevent the app shell from rendering.
    }

    if (user?.id) {
      void loadNotificationSettings(user.id)
        .then(async settings => {
          if (active && settings.enabled) {
            await registerNotificationDevice(user.id);
          }
        })
        .catch(() => undefined);
    }

    return () => { active = false; };
  }, [appLoading, authReady, user?.id]);

  useEffect(() => {
    if (!authReady || appLoading || !languageReady) return;
    void SplashScreen.hideAsync();
  }, [appLoading, authReady, languageReady]);
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
      <SwipeNavigationShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
          <Stack.Screen name="auth/callback" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="streak-broken" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="focus/active" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="focus/setup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="focus/allowed-apps" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="focus/complete" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="focus/levelup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="focus/broken" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="referral" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="todo" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="calendar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="study-groups/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="study-groups/create" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="study-groups/join" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="study-groups/[groupId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="raise-ticket" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="review-tickets" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin/study-groups" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tracker/[subjectId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tracker/chapters/[chapterId]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SwipeNavigationShell>
      <AuthRouteGuard />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthSessionProvider>
            <AppProvider>
              <AppNavigation />
            </AppProvider>
          </AuthSessionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
