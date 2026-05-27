import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/contexts/AppContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="streak-broken" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="focus/active" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="focus/complete" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="focus/broken" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="tracker/[subjectId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tracker/chapters/[chapterId]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
