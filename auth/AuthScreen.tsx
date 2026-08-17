import { useState, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from './AuthSessionProvider';
import { getPasswordProviderError, validatePassword } from './passwordPolicy';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

type Mode = 'login' | 'signup' | 'forgot';
type FieldName = 'name' | 'email' | 'referralCode' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signIn, signUp, resendSignupConfirmation, sendPasswordReset } = useAuthSession();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const clearFeedback = () => {
    setFieldErrors({});
    setMessage(null);
    setVerificationEmail(null);
  };

  const updateField = (field: FieldName, value: string) => {
    if (fieldErrors[field]) {
      setFieldErrors(previous => ({ ...previous, [field]: undefined }));
    }
    if (field === 'name') setName(value);
    if (field === 'email') setEmail(value);
    if (field === 'password') {
      setPasswordTouched(true);
      setPassword(value);
    }
    if (field === 'referralCode') setReferralCode(value.toUpperCase().replace(/\s/g, ''));
  };

  const submit = async () => {
    clearFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: FieldErrors = {};
    if (!normalizedEmail || !normalizedEmail.includes('@')) nextErrors.email = 'Please enter a valid email address.';
    if (mode !== 'forgot') {
      const passwordResult = validatePassword(password);
      if (!passwordResult.valid) nextErrors.password = passwordResult.error;
    }
    if (mode === 'signup' && name.trim().length < 2) nextErrors.name = 'Please enter your name.';
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(normalizedEmail, password);
        // AuthRouteGuard performs the redirect after AppContext has hydrated the profile.
        // Navigating here would mount the dashboard one render too early and briefly show
        // its generic Student fallback after relogin.
      } else if (mode === 'signup') {
        const result = await signUp(name, normalizedEmail, password, referralCode);
        if (result.requiresEmailConfirmation) {
          setVerificationEmail(result.email);
          setMessage('Account created. Please verify your email, then sign in.');
          setMode('login');
        }
      } else {
        await sendPasswordReset(normalizedEmail);
        setMessage('Reset link sent. Please check your email.');
      }
    } catch (submitError: any) {
      const errorMessage = submitError?.message ?? 'Something went wrong. Please try again.';
      const normalizedError = errorMessage.toLowerCase();
      const passwordProviderError = getPasswordProviderError(errorMessage);
      if (passwordProviderError) {
        setFieldErrors({ password: passwordProviderError });
      } else if (normalizedError.includes('rate') || normalizedError.includes('too many') || normalizedError.includes('429')) {
        setMessage('Too many requests. Please wait a moment and try again.');
      } else if (
        normalizedError.includes('referral code') ||
        (mode === 'signup' && referralCode.trim().length > 0 && normalizedError.includes('database error saving new user'))
      ) {
        setFieldErrors({ referralCode: 'Invalid referral code. Please check it and try again.' });
      } else if (mode === 'login' && normalizedError.includes('invalid login')) {
        setFieldErrors({ password: 'Email or password is incorrect.' });
      } else if (mode === 'signup' && (normalizedError.includes('already registered') || normalizedError.includes('already been registered') || normalizedError.includes('user already exists'))) {
        setFieldErrors({ email: 'An account with this email already exists. Try signing in instead.' });
      } else if (normalizedError.includes('verify your email')) {
        setMessage('Please verify your email address before signing in.');
      } else if (mode === 'forgot' && normalizedError.includes('email address') && normalizedError.includes('invalid')) {
        setFieldErrors({ email: 'We could not send a reset link to this address. Please check the email and try again.' });
      } else {
        setMessage(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!verificationEmail || busy) return;
    setBusy(true);
    try {
      await resendSignupConfirmation(verificationEmail);
      setMessage('Verification email sent again. Please check your inbox.');
    } catch (resendError: any) {
      const resendMessage = resendError?.message?.toLowerCase() ?? '';
      setMessage(resendMessage.includes('rate') || resendMessage.includes('too many')
        ? 'Too many requests. Please wait before trying again.'
        : 'We could not resend the verification email. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password';
  const buttonLabel = mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.brandMark}><Text style={styles.logo}>पढ़<Text style={styles.logoAccent}>AI</Text></Text></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Focus your mind. Build your future.</Text>

          <View style={styles.formCard}>
            {mode === 'signup' ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <TextInput style={[styles.input, fieldErrors.name && styles.inputError]} placeholder="Your full name" placeholderTextColor={colors.textTertiary} value={name} onChangeText={value => updateField('name', value)} autoCapitalize="words" />
                {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput style={[styles.input, fieldErrors.email && styles.inputError]} placeholder="you@example.com" placeholderTextColor={colors.textTertiary} value={email} onChangeText={value => updateField('email', value)} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
              {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
            </View>

            {mode === 'signup' ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>REFERRAL CODE <Text style={styles.optionalLabel}>(OPTIONAL)</Text></Text>
                <TextInput style={[styles.input, fieldErrors.referralCode && styles.inputError]} placeholder="ENTER CODE" placeholderTextColor={colors.textTertiary} value={referralCode} onChangeText={value => updateField('referralCode', value)} autoCapitalize="characters" autoCorrect={false} keyboardType="default" />
                {fieldErrors.referralCode ? <Text style={styles.fieldError}>{fieldErrors.referralCode}</Text> : <Text style={styles.helperText}>Use uppercase letters only.</Text>}
              </View>
            ) : null}

            {mode !== 'forgot' ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <TextInput style={[styles.input, fieldErrors.password && styles.inputError]} placeholder="At least 6 characters" placeholderTextColor={colors.textTertiary} value={password} onChangeText={value => updateField('password', value)} secureTextEntry autoCapitalize="none" autoCorrect={false} />
                {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : passwordTouched && password.length > 0 && !validatePassword(password).valid ? (
                  <Text style={styles.fieldError}>{validatePassword(password).error}</Text>
                ) : (
                  <Text style={styles.helperText}>Minimum 6 characters with uppercase, lowercase, number, and symbol.</Text>
                )}
              </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}
            {verificationEmail ? (
              <Pressable onPress={resendVerification} style={styles.secondaryAction} disabled={busy}>
                <Text style={styles.secondaryText}>Resend verification email</Text>
              </Pressable>
            ) : null}

            <Pressable style={({ pressed }) => [styles.primaryButton, busy && styles.disabled, pressed && !busy && styles.pressed]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{buttonLabel}</Text>}
            </Pressable>
          </View>

          {mode !== 'forgot' ? <Text style={styles.comingSoonText}>Google signup — Coming Soon</Text> : null}
          {mode === 'login' ? <Pressable onPress={() => { clearFeedback(); setMode('forgot'); }} style={styles.secondaryAction}><Text style={styles.secondaryText}>Forgot password?</Text></Pressable> : null}
          <Pressable onPress={() => { clearFeedback(); setMode(mode === 'login' ? 'signup' : 'login'); }} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>{mode === 'login' ? 'Create a new account' : 'Back to sign in'}</Text>
          </Pressable>
          {mode === 'forgot' ? <Pressable onPress={() => { clearFeedback(); setMode('login'); }} style={styles.secondaryAction}><Text style={styles.secondaryText}>Cancel</Text></Pressable> : null}
          <Pressable onPress={() => router.push('/privacy-policy' as Parameters<typeof router.push>[0])} style={styles.policyAction}><Text style={styles.policyText}>Privacy Policy</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brandMark: { alignItems: 'center', marginBottom: 4 },
  logo: { color: colors.textPrimary, fontSize: 56, fontWeight: '900', textAlign: 'center', letterSpacing: -2 },
  logoAccent: { color: colors.primary },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  subtitle: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  formCard: { width: '100%', alignSelf: 'stretch', overflow: 'hidden', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 18, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 7 },
  optionalLabel: { color: colors.textTertiary, fontWeight: '600', letterSpacing: 0 },
  input: { width: '100%', alignSelf: 'stretch', minWidth: 0, backgroundColor: colors.surfaceVariant, borderColor: colors.borderStrong, borderRadius: 13, borderWidth: 1, color: colors.textPrimary, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15 },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerDim + '35' },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 5 },
  helperText: { color: colors.textTertiary, fontSize: 11, marginTop: 5 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  comingSoonText: { color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 16 },
  secondaryAction: { alignItems: 'center', paddingVertical: 11 },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  policyAction: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  policyText: { color: colors.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
  message: { color: colors.success, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
});
