import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';

interface Props {
  onSwitchToLogin: () => void;
}

function getSignupErrors(name: string, email: string, password: string) {
  const errors: {
    name?: string;
    email?: string;
    password?: string;
  } = {};

  if (!name.trim()) {
    errors.name = 'Full name is required.';
  } else if (name.trim().length < 3) {
    errors.name = 'Name must be at least 3 characters.';
  } else if (name.trim().length > 40) {
    errors.name = 'Name must be under 40 characters.';
  }

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password.trim()) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  } else if (password.length > 72) {
    errors.password = 'Password must be under 72 characters.';
  }

  return errors;
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  const errors = submitted ? getSignupErrors(name, email, password) : {};
  const hasErrors = Object.keys(errors).length > 0;

  async function handleSignup() {
    setSubmitted(true);
    setApiError(null);
    setApiSuccess(null);

    const currentErrors = getSignupErrors(name, email, password);
    if (Object.keys(currentErrors).length > 0) return;

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();
      const trimmedName = name.trim();

      // ── Step 1: Attempt signup ────────────────────────────────────────────
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: { data: { name: trimmedName } },
      });

      // ── Step 2: Handle signup-level errors ────────────────────────────────
      if (signupError) {
        // Only show "already registered" for actual signup-level errors
        const msg = signupError.message.toLowerCase();
        if (
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('user already')
        ) {
          setApiError(
            'An account with this email already exists. Please sign in.'
          );
        } else {
          setApiError(signupError.message);
        }
        return;
      }

      // ── Step 3: Session returned — email confirm is OFF ───────────────────
      if (signupData?.session) {
        router.replace('/onboarding');
        return;
      }

      // ── Step 4: No session — try immediate sign-in ────────────────────────
      // Supabase sometimes creates the user but doesn't return a session.
      // Attempt sign-in with same credentials to get a session.
      if (signupData?.user) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          });

        if (!signInError && signInData?.session) {
          // Successfully signed in — go to onboarding
          router.replace('/onboarding');
          return;
        }

        if (signInError?.message === 'Email not confirmed') {
          // Email confirmation is ON in Supabase — tell user to verify
          setApiSuccess(
            'Account created! Please check your email to verify your address, then sign in.'
          );
          return;
        }

        // Sign-in failed for unknown reason — account was still created
        setApiSuccess(
          'Account created! Please sign in.'
        );
        return;
      }

      // ── Fallback ──────────────────────────────────────────────────────────
      setApiError('Something went wrong. Please try again.');

    } catch (err: any) {
      setApiError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Start your focused study journey today</Text>

      {apiError ? (
        <View style={styles.apiErrorBox}>
          <Text style={styles.apiErrorIcon}>⚠ </Text>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      ) : null}

      {apiSuccess ? (
        <View style={styles.apiSuccessBox}>
          <Text style={styles.apiSuccessIcon}>✓ </Text>
          <Text style={styles.apiSuccessText}>{apiSuccess}</Text>
        </View>
      ) : null}

      <AuthInput
        label="Full Name"
        placeholder="e.g. Devansh"
        value={name}
        onChangeText={(t) => { setName(t); setApiError(null); }}
        autoCapitalize="words"
        autoCorrect={false}
        error={errors.name}
      />

      <AuthInput
        label="Email Address"
        placeholder="your@email.com"
        value={email}
        onChangeText={(t) => { setEmail(t); setApiError(null); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
      />

      <AuthInput
        label="Password"
        placeholder="At least 6 characters"
        value={password}
        onChangeText={(t) => { setPassword(t); setApiError(null); }}
        secureTextEntry
        error={errors.password}
      />

      <AuthButton
        label={loading ? 'Creating account...' : 'Create Account →'}
        onPress={handleSignup}
        loading={loading}
        disabled={submitted && hasErrors}
        style={styles.submitBtn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <TouchableOpacity
          onPress={onSwitchToLogin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.switchLink}>Sign in</Text>
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
  apiErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  apiErrorIcon: {
    color: '#FF4757',
    fontSize: 14,
  },
  apiErrorText: {
    flex: 1,
    color: '#FF4757',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  apiSuccessBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(46, 213, 115, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  apiSuccessIcon: {
    color: '#2ED573',
    fontSize: 14,
    fontWeight: '700',
  },
  apiSuccessText: {
    flex: 1,
    color: '#2ED573',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
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
