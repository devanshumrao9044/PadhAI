import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { completeGoogleOAuthCallback, isGoogleOAuthCallbackUrl } from '@/auth/googleOAuth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const finish = async () => {
      const initialUrl = await Linking.getInitialURL();
      const webUrl = typeof window !== 'undefined' ? window.location.href : '';
      const callbackUrl = initialUrl || webUrl;

      if (!callbackUrl || !isGoogleOAuthCallbackUrl(callbackUrl)) {
        router.replace('/login' as Parameters<typeof router.replace>[0]);
        return;
      }

      try {
        await completeGoogleOAuthCallback(callbackUrl);
        if (active) router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
      } catch (callbackError: any) {
        if (active) setError(callbackError?.message ?? 'Google sign-in could not be completed.');
      }
    };

    void finish();
    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Google sign-in failed</Text>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.help} onPress={() => router.replace('/login' as Parameters<typeof router.replace>[0])}>Return to sign in</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7C5CFC" />
      <Text style={styles.title}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0F', padding: 24 },
  title: { color: '#F1F1F6', fontSize: 20, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  error: { color: '#FF6675', fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: 'center' },
  help: { color: '#B5A6FF', fontSize: 15, fontWeight: '700', marginTop: 22, textDecorationLine: 'underline' },
});
