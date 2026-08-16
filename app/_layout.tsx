import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/contexts/AppContext';
import { AuthSessionProvider } from '@/auth/AuthSessionProvider';
import AuthRouteGuard from '@/auth/AuthRouteGuard';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

function AppNavigation() {
  const { mode, colors } = useTheme();
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
        <AuthSessionProvider>
          <AppProvider>
            <AppNavigation />
          </AppProvider>
        </AuthSessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
