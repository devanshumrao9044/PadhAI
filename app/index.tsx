import { useState } from 'react';
import {
  View, Text, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  Pressable, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

// ── Validation ────────────────────────────────────────────────────────────────
function getLoginErrors(email: string, password: string) {
  const e: { email?: string; password?: string } = {};
  if (!email.trim()) e.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    e.email = 'Please enter a valid email address.';
  if (!password.trim()) e.password = 'Password is required.';
  else if (password.length < 6)
    e.password = 'Password must be at least 6 characters.';
  return e;
}

function getSignupErrors(name: string, email: string, password: string) {
  const e: { name?: string; email?: string; password?: string } = {};
  if (!name.trim()) e.name = 'Full name is required.';
  else if (name.trim().length < 3)
    e.name = 'Name must be at least 3 characters.';
  if (!email.trim()) e.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    e.email = 'Please enter a valid email address.';
  if (!password.trim()) e.password = 'Password is required.';
  else if (password.length < 6)
    e.password = 'Password must be at least 6 characters.';
  return e;
}

function getForgotErrors(email: string) {
  const e: { email?: string } = {};
  if (!email.trim()) e.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    e.email = 'Please enter a valid email address.';
  return e;
}

// ── Reusable Input ────────────────────────────────────────────────────────────
function AuthInput({
  label, error, style, ...props
}: {
  label: string;
  error?: string;
  style?: any;
  [key: string]: any;
}) {
  return (
    <View style={ai.wrapper}>
      <Text style={ai.label}>{label}</Text>
      <TextInput
        style={[ai.input, error ? ai.inputError : ai.inputNormal, style]}
        placeholderTextColor="#4B5563"
        {...(Platform.OS === 'web' ? { outlineWidth: 0 } : {})}
        {...props}
      />
      <View style={ai.errorSlot}>
        {error ? <Text style={ai.errorText}>⚠ {error}</Text> : null}
      </View>
    </View>
  );
}

const ai = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  label: {
    color: '#9CA3AF', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#F1F1F6', fontSize: 15, borderWidth: 1.5,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : {}),
  } as any,
  inputNormal: { backgroundColor: '#1A1A27', borderColor: 'rgba(255,255,255,0.07)' },
  inputError: { backgroundColor: 'rgba(255,71,87,0.05)', borderColor: '#FF4757' },
  errorSlot: { minHeight: 20, marginTop: 4, marginLeft: 2 },
  errorText: { color: '#FF4757', fontSize: 12, fontWeight: '600' },
});

// ── Reusable Button ───────────────────────────────────────────────────────────
function AuthButton({
  label, onPress, loading = false,
  disabled = false, variant = 'primary', style
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  style?: any;
}) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        ab.base,
        isPrimary ? ab.primary : ab.ghost,
        isDisabled && ab.disabled,
        pressed && !isDisabled && ab.pressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={isPrimary ? '#FFF' : '#7C5CFC'} size="small" />
        : <Text style={[ab.label, !isPrimary && ab.labelGhost]}>{label}</Text>
      }
    </Pressable>
  );
}

const ab = StyleSheet.create({
  base: {
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  primary: { backgroundColor: '#7C5CFC' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },
  label: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  labelGhost: { color: '#9CA3AF' },
});

// ── Error Box ─────────────────────────────────────────────────────────────────
function ErrorBox({ message }: { message: string }) {
  return (
    <View style={eb.box}>
      <Text style={eb.icon}>⚠ </Text>
      <Text style={eb.text}>{message}</Text>
    </View>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <View style={eb.successBox}>
      <Text style={eb.successIcon}>✓ </Text>
      <Text style={eb.successText}>{message}</Text>
    </View>
  );
}

const eb = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(255,71,87,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,71,87,0.35)',
    borderRadius: 10, padding: 12, marginBottom: 20,
  },
  icon: { color: '#FF4757', fontSize: 14 },
  text: { flex: 1, color: '#FF4757', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  successBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(46,213,115,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,213,115,0.35)',
    borderRadius: 10, padding: 12, marginBottom: 20,
  },
  successIcon: { color: '#2ED573', fontSize: 14, fontWeight: '700' },
  successText: { flex: 1, color: '#2ED573', fontSize: 13, fontWeight: '600', lineHeight: 18 },
});

// ── Screen Mode ───────────────────────────────────────────────────────────────
type Mode = 'login' | 'signup' | 'forgot';

// ═════════════════════════════════════════════════════════════════════════════
// MAIN AUTH SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginApiError, setLoginApiError] = useState<string | null>(null);

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupReferral, setSignupReferral] = useState('');
  const [signupSubmitted, setSignupSubmitted] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupApiError, setSignupApiError] = useState<string | null>(null);
  const [signupApiSuccess, setSignupApiSuccess] = useState<string | null>(null);

  // Forgot state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotApiError, setForgotApiError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Computed errors during render — no async state issues
  const loginErrors = loginSubmitted
    ? getLoginErrors(loginEmail, loginPassword) : {};
  const signupErrors = signupSubmitted
    ? getSignupErrors(signupName, signupEmail, signupPassword) : {};
  const forgotErrors = forgotSubmitted
    ? getForgotErrors(forgotEmail) : {};

  // ── Login Handler ───────────────────────────────────────────────────────────
  async function handleLogin() {
    setLoginSubmitted(true);
    setLoginApiError(null);
    if (Object.keys(getLoginErrors(loginEmail, loginPassword)).length > 0) return;
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword.trim(),
      });
      if (error) {
        switch (error.message) {
          case 'Invalid login credentials':
            setLoginApiError('Incorrect email or password. Please try again.');
            break;
          case 'Email not confirmed':
            setLoginApiError('Please verify your email before signing in.');
            break;
          case 'Too many requests':
            setLoginApiError('Too many attempts. Please wait and try again.');
            break;
          default:
            setLoginApiError(error.message ?? 'Login failed. Please try again.');
        }
        return;
      }
      if (!data?.user) { setLoginApiError('Login failed. Please try again.'); return; }
      const { data: profile } = await supabase
        .from('users').select('name').eq('id', data.user.id).single();
      if (!profile?.name || profile.name === 'Student') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setLoginApiError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Signup Handler ──────────────────────────────────────────────────────────
  async function handleSignup() {
    setSignupSubmitted(true);
    setSignupApiError(null);
    setSignupApiSuccess(null);
    if (Object.keys(getSignupErrors(signupName, signupEmail, signupPassword)).length > 0) return;
    setSignupLoading(true);
    try {
      const trimmedEmail = signupEmail.trim().toLowerCase();
      const trimmedPassword = signupPassword.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: { data: { name: signupName.trim() } },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists')) {
          setSignupApiError('This email is already registered. Please sign in instead.');
        } else {
          setSignupApiError(error.message);
        }
        return;
      }

      // Apply referral code if entered
      if (signupReferral.trim() && data?.user) {
        const { data: referrer } = await supabase
          .from('users')
          .select('id')
          .eq('my_referral_code', signupReferral.trim().toUpperCase())
          .maybeSingle();
        if (referrer && referrer.id !== data.user.id) {
          await supabase.from('users')
            .update({ referred_by: signupReferral.trim().toUpperCase() })
            .eq('id', data.user.id);
          await supabase.from('referrals').insert({
            referrer_id: referrer.id,
            referee_id: data.user.id,
            status: 'pending',
          });
        }
      }

      if (data?.session) { router.replace('/onboarding'); return; }
      if (data?.user) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail, password: trimmedPassword,
          });
        if (!signInError && signInData?.session) {
          router.replace('/onboarding'); return;
        }
        if (signInError?.message === 'Email not confirmed') {
          setSignupApiSuccess('Account created! Please verify your email, then sign in.');
          return;
        }
        setSignupApiSuccess('Account created! Please sign in.');
        return;
      }
      setSignupApiError('Something went wrong. Please try again.');
    } catch (err: any) {
      setSignupApiError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setSignupLoading(false);
    }
  }

  // ── Forgot Handler ──────────────────────────────────────────────────────────
  async function handleForgotPassword() {
    setForgotSubmitted(true);
    setForgotApiError(null);
    setForgotSuccess(null);
    if (Object.keys(getForgotErrors(forgotEmail)).length > 0) return;
    setForgotLoading(true);
    try {
      const trimmedEmail = forgotEmail.trim().toLowerCase();
      const { data: existingUser } = await supabase
        .from('users').select('id').eq('email', trimmedEmail).maybeSingle();
      if (!existingUser) {
        setForgotApiError('No account found with this email. Please sign up first.');
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'padhai://reset-password',
      });
      if (error) { setForgotApiError(error.message); return; }
      setForgotSuccess(`Reset link sent to ${trimmedEmail}. Check your inbox.`);
    } catch (err: any) {
      setForgotApiError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setForgotLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <View style={s.logoBox}>
            <Text style={s.logoText}>पढ़</Text>
            <Text style={s.logoAI}>AI</Text>
          </View>
          <Text style={s.tagline}>"Stay Focused. Study Hard. No Excuses."</Text>

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Welcome back</Text>
              <Text style={s.cardSubtitle}>Sign in to continue your streak</Text>
              {loginApiError ? <ErrorBox message={loginApiError} /> : null}
              <AuthInput
                label="Email Address"
                placeholder="your@email.com"
                value={loginEmail}
                onChangeText={(t: string) => { setLoginEmail(t); setLoginApiError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={loginErrors.email}
              />
              <AuthInput
                label="Password"
                placeholder="Enter your password"
                value={loginPassword}
                onChangeText={(t: string) => { setLoginPassword(t); setLoginApiError(null); }}
                secureTextEntry
                error={loginErrors.password}
              />
              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(loginEmail);
                  setForgotSubmitted(false);
                  setForgotApiError(null);
                  setForgotSuccess(null);
                  setMode('forgot');
                }}
                style={s.forgotRow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
              <AuthButton
                label={loginLoading ? 'Signing in...' : 'Sign In →'}
                onPress={handleLogin}
                loading={loginLoading}
                disabled={loginSubmitted && Object.keys(loginErrors).length > 0}
                style={s.submitBtn}
              />
              <View style={s.switchRow}>
                <Text style={s.switchText}>{"Don't have an account? "}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSignupSubmitted(false);
                    setSignupApiError(null);
                    setSignupApiSuccess(null);
                    setMode('signup');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.switchLink}>Create account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── SIGNUP ── */}
          {mode === 'signup' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Create account</Text>
              <Text style={s.cardSubtitle}>Start your focused study journey today</Text>
              {signupApiError ? <ErrorBox message={signupApiError} /> : null}
              {signupApiSuccess ? <SuccessBox message={signupApiSuccess} /> : null}
              <AuthInput
                label="Full Name"
                placeholder="e.g. Devansh "
                value={signupName}
                onChangeText={(t: string) => { setSignupName(t); setSignupApiError(null); }}
                autoCapitalize="words"
                autoCorrect={false}
                error={signupErrors.name}
              />
              <AuthInput
                label="Email Address"
                placeholder="your@email.com"
                value={signupEmail}
                onChangeText={(t: string) => { setSignupEmail(t); setSignupApiError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={signupErrors.email}
              />
              <AuthInput
                label="Password"
                placeholder="At least 6 characters"
                value={signupPassword}
                onChangeText={(t: string) => { setSignupPassword(t); setSignupApiError(null); }}
                secureTextEntry
                error={signupErrors.password}
              />
              <AuthInput
                label="Referral Code (Optional)"
                placeholder="e.g. DEVS12345"
                value={signupReferral}
                onChangeText={(t: string) => setSignupReferral(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <AuthButton
                label={signupLoading ? 'Creating account...' : 'Create Account →'}
                onPress={handleSignup}
                loading={signupLoading}
                disabled={signupSubmitted && Object.keys(signupErrors).length > 0}
                style={s.submitBtn}
              />
              <View style={s.switchRow}>
                <Text style={s.switchText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => {
                    setLoginSubmitted(false);
                    setLoginApiError(null);
                    setMode('login');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.switchLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && (
            <View style={s.card}>
              <TouchableOpacity
                onPress={() => setMode('login')}
                style={s.backRow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.backArrow}>←</Text>
                <Text style={s.backText}>Back to Sign In</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>Reset password</Text>
              <Text style={s.cardSubtitle}>
                Enter your email and we will send a reset link.
              </Text>
              {forgotApiError ? <ErrorBox message={forgotApiError} /> : null}
              {forgotSuccess ? <SuccessBox message={forgotSuccess} /> : null}
              {!forgotSuccess ? (
                <>
                  <AuthInput
                    label="Email Address"
                    placeholder="your@email.com"
                    value={forgotEmail}
                    onChangeText={(t: string) => {
                      setForgotEmail(t);
                      setForgotApiError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={forgotErrors.email}
                  />
                  <AuthButton
                    label={forgotLoading ? 'Sending...' : 'Send Reset Link →'}
                    onPress={handleForgotPassword}
                    loading={forgotLoading}
                    style={s.submitBtn}
                  />
                </>
              ) : (
                <AuthButton
                  label="Back to Sign In"
                  onPress={() => setMode('login')}
                  variant="ghost"
                  style={s.submitBtn}
                />
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  flex: { flex: 1 },
  content: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 32,
  },
  logoBox: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 8,
  },
  logoText: {
    fontSize: 56, fontWeight: '900', color: '#FFFFFF',
    includeFontPadding: false,
  },
  logoAI: {
    fontSize: 56, fontWeight: '900', color: '#7C5CFC',
    includeFontPadding: false,
  },
  tagline: {
    color: '#6B7280', fontSize: 13, fontStyle: 'italic',
    textAlign: 'center', marginBottom: 32, letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#0F0F1A', borderRadius: 20,
    padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(124,92,252,0.15)',
  },
  cardTitle: {
    color: '#F1F1F6', fontSize: 24, fontWeight: '800',
    marginBottom: 4, includeFontPadding: false,
  },
  cardSubtitle: { color: '#6B7280', fontSize: 13, marginBottom: 24 },
  forgotRow: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 20 },
  forgotText: { color: '#7C5CFC', fontSize: 13, fontWeight: '600' },
  backRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 20,
  },
  backArrow: { color: '#7C5CFC', fontSize: 16, fontWeight: '700' },
  backText: { color: '#7C5CFC', fontSize: 13, fontWeight: '600' },
  submitBtn: { marginTop: 4, marginBottom: 20 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  switchText: { color: '#6B7280', fontSize: 13 },
  switchLink: { color: '#7C5CFC', fontSize: 13, fontWeight: '700' },
});
