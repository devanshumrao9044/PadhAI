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
import { loadNotificationSettings } from '@/services/localNotifications';
import { registerNotificationDevice } from '@/services/adminNotifications';

void SplashScreen.preventAutoHideAsync();

function AppNavigation() {
  const { mode, colors } = useTheme();
  const { ready: authReady } = useAuthSession();
  const { isLoading: appLoading, user } = useApp();
  const { ready: languageReady } = useLanguage();

  useEffect(() => {
    if (!authReady || appLoading || !user?.id) return;
    let active = true;
    void loadNotificationSettings(user.id).then(settings => {
      if (active && settings.enabled) void registerNotificationDevice(user.id);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [appLoading, authReady, user?.id]);

  useEffect(() => {
    if (!authReady || appLoading || !languageReady) return;
    void SplashScreen.hideAsync();
  }, [appLoading, authReady, languageReady]);
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
        <Stack.Screen name="todo" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="calendar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tracker/[subjectId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tracker/chapters/[chapterId]" options={{ animation: 'slide_from_right' }} />
      </Stack>
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
