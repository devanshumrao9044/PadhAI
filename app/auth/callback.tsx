import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '@/auth/AuthSessionProvider';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, ThemeColors } from '@/constants/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, ready } = useAuthSession();
  const { isLoading: appLoading, isOnboarded } = useApp();
  const redirectedRef = useRef(false);
  const styles = createStyles(colors);

  useEffect(() => {
    if (!ready || !session || appLoading || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace(isOnboarded ? '/(tabs)' : '/onboarding');
  }, [appLoading, isOnboarded, ready, router, session]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>पढ़<Text style={styles.logoAccent}>AI</Text></Text>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.title}>Completing Google sign-in</Text>
        <Text style={styles.subtitle}>Please wait while we prepare your PadhAI profile.</Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  logo: { color: colors.textPrimary, fontSize: 52, fontWeight: FontWeight.bold, marginBottom: Spacing.xl },
  logoAccent: { color: colors.primary },
  title: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.lg, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.md, lineHeight: 22, marginTop: Spacing.sm, textAlign: 'center' },
});
