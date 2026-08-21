import { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/features/core/services/supabase';
import { useAuthSession } from '@/auth/AuthSessionProvider';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { signOut } = useAuthSession();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const consumeRecoveryUrl = async (url: string | null) => {
      try {
        if (url) {
          const fragmentStart = url.indexOf('#');
          const queryStart = url.indexOf('?');
          const tokenText = fragmentStart >= 0
            ? url.slice(fragmentStart + 1)
            : queryStart >= 0
              ? url.slice(queryStart + 1)
              : '';
          const params = new URLSearchParams(tokenText);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setReady(Boolean(session));
        setChecking(false);
        if (!session) {
          setError('This reset link is invalid or has expired. Please request a new one.');
        }
      } catch (resetError: any) {
        if (!mounted) return;
        setChecking(false);
        setReady(false);
        setError(resetError?.message ?? 'Unable to open the reset link.');
      }
    };

    void Linking.getInitialURL().then(consumeRecoveryUrl);
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void consumeRecoveryUrl(url);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || !session) return;
      setReady(true);
      setChecking(false);
      setError(null);
    });

    return () => {
      mounted = false;
      linkingSubscription.remove();
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const nextPasswordError = password.length < 6 ? 'Password must be at least 6 characters.' : '';
    const nextConfirmError = password !== confirmPassword ? 'Passwords do not match.' : '';
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    await signOut();
  };

  if (checking) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>पढ़<Text style={styles.logoAccent}>AI</Text></Text>
          <Text style={styles.title}>{success ? 'Password updated' : 'Reset password'}</Text>
          <Text style={styles.subtitle}>
            {success
              ? 'Your password was changed. Sign in with the new password.'
              : 'Choose a strong password for your account.'}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? null : ready ? (
            <View style={styles.card}>
              <TextInput
                style={[styles.input, passwordError && styles.inputError]}
                placeholder="New password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={value => { setPassword(value); if (value.length >= 6) setPasswordError(''); }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
              <TextInput
                style={[styles.input, confirmError && styles.inputError]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={value => { setConfirmPassword(value); if (value === password) setConfirmError(''); }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
              <Pressable
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>Update password</Text>}
              </Pressable>
            </View>
          ) : null}

          <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
            <Text style={styles.backText}>{success ? 'Continue to sign in' : 'Back to sign in'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: colors.textPrimary, fontSize: 52, fontWeight: '900', textAlign: 'center' },
  logoAccent: { color: colors.primary },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 24 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.surfaceVariant, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerDim + '25' },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: -7, marginBottom: 10 },
  button: { minHeight: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  backButton: { alignItems: 'center', paddingVertical: 18 },
  backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});

