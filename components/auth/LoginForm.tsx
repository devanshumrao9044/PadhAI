import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';

interface Props {
  onSwitchToSignup: () => void;
}

type Mode = 'login' | 'forgot';

function getLoginErrors(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!password.trim()) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  return errors;
}

function getForgotErrors(email: string) {
  const errors: { email?: string } = {};
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  return errors;
}

export default function LoginForm({ onSwitchToSignup }: Props) {
  const [mode, setMode] = useState<Mode>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginApiError, setLoginApiError] = useState<string | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotApiError, setForgotApiError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Login errors — computed during render
  const loginErrors = loginSubmitted
    ? getLoginErrors(email, password)
    : {};
  const loginHasErrors = Object.keys(loginErrors).length > 0;

  // Forgot errors — computed during render
  const forgotErrors = forgotSubmitted
    ? getForgotErrors(forgotEmail)
    : {};

  function switchToForgot() {
    setMode('forgot');
    setForgotEmail('');
    setForgotSubmitted(false);
    setForgotApiError(null);
    setForgotSuccess(null);
  }

  function switchToLogin() {
    setMode('login');
  }

  // ── Login handler ─────────────────────────────────────────────────────────
  async function handleForgotPassword() {
  setForgotSubmitted(true);
  setForgotApiError(null);
  setForgotSuccess(null);

  if (Object.keys(getForgotErrors(forgotEmail)).length > 0) return;

  setForgotLoading(true);
  try {
    const trimmedEmail = forgotEmail.trim().toLowerCase();

    // Step 1: Check if account exists
    // Note: ignore lookupError — RLS may block read but null data = no user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (!existingUser) {
      setForgotApiError(
        'No account found with this email. Please sign up first.'
      );
      return;
    }

    // Step 2: Account exists — send reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmedEmail,
      { redirectTo: 'padhai://reset-password' }
    );

    if (resetError) {
      setForgotApiError(resetError.message ?? 'Failed to send reset email.');
      return;
    }

    setForgotSuccess(
      `Password reset link sent to ${trimmedEmail}. Check your inbox.`
    );

  } catch (err: any) {
    setForgotApiError(err?.message ?? 'An unexpected error occurred.');
  } finally {
    setForgotLoading(false);
  }
    }
      // ── Step 2: Account exists — send reset email ─────────────────────────
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo: 'padhai://reset-password' }
      );

      if (resetError) {
        setForgotApiError(resetError.message ?? 'Failed to send reset email.');
        return;
      }

      setForgotSuccess(
        `Password reset link sent to ${trimmedEmail}. Check your inbox.`
      );

    } catch (err: any) {
      setForgotApiError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setForgotLoading(false);
    }
  }

  // FORGOT PASSWORD VIEW
  if (mode === 'forgot') {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          onPress={switchToLogin}
          style={styles.backRow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back to Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send a reset link.
        </Text>

        {forgotApiError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>⚠ </Text>
            <Text style={styles.errorBoxText}>{forgotApiError}</Text>
          </View>
        ) : null}

        {forgotSuccess ? (
          <View style={styles.successBox}>
            <Text style={styles.successBoxIcon}>✓ </Text>
            <Text style={styles.successBoxText}>{forgotSuccess}</Text>
          </View>
        ) : null}

        {!forgotSuccess ? (
          <>
            <AuthInput
              label="Email Address"
              placeholder="your@email.com"
              value={forgotEmail}
              onChangeText={(t) => {
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
              style={styles.submitBtn}
            />
          </>
        ) : (
          <AuthButton
            label="Back to Sign In"
            onPress={switchToLogin}
            variant="secondary"
            style={styles.submitBtn}
          />
        )}
      </View>
    );
  }

  // LOGIN VIEW
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue your streak</Text>

      {loginApiError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxIcon}>⚠ </Text>
          <Text style={styles.errorBoxText}>{loginApiError}</Text>
        </View>
      ) : null}

      <AuthInput
        label="Email Address"
        placeholder="your@email.com"
        value={email}
        onChangeText={(t) => { setEmail(t); setLoginApiError(null); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={loginErrors.email}
      />

      <AuthInput
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={(t) => { setPassword(t); setLoginApiError(null); }}
        secureTextEntry
        error={loginErrors.password}
      />

      {/* Forgot password link */}
      <TouchableOpacity
        onPress={switchToForgot}
        style={styles.forgotRow}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <AuthButton
        label={loginLoading ? 'Signing in...' : 'Sign In →'}
        onPress={handleLogin}
        loading={loginLoading}
        disabled={loginSubmitted && loginHasErrors}
        style={styles.submitBtn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{"Don't have an account? "}</Text>
        <TouchableOpacity
          onPress={onSwitchToSignup}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.switchLink}>Create account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F0F1A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.15)',
  },
  title: {
    color: '#F1F1F6',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    includeFontPadding: false,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  backArrow: {
    color: '#7C5CFC',
    fontSize: 16,
    fontWeight: '700',
  },
  backText: {
    color: '#7C5CFC',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorBoxIcon: {
    color: '#FF4757',
    fontSize: 14,
  },
  errorBoxText: {
    flex: 1,
    color: '#FF4757',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(46, 213, 115, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  successBoxIcon: {
    color: '#2ED573',
    fontSize: 14,
    fontWeight: '700',
  },
  successBoxText: {
    flex: 1,
    color: '#2ED573',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 20,
  },
  forgotText: {
    color: '#7C5CFC',
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 4,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#6B7280',
    fontSize: 13,
  },
  switchLink: {
    color: '#7C5CFC',
    fontSize: 13,
    fontWeight: '700',
  },
});
