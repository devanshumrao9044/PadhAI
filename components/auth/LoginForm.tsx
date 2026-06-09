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

export default function LoginForm({ onSwitchToSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const errors = submitted ? getLoginErrors(email, password) : {};
  const hasErrors = Object.keys(errors).length > 0;

  async function handleLogin() {
    setSubmitted(true);
    setApiError(null);

    const currentErrors = getLoginErrors(email, password);
    if (Object.keys(currentErrors).length > 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error) {
        switch (error.message) {
          case 'Invalid login credentials':
            setApiError('Incorrect email or password. Please try again.');
            break;
          case 'Email not confirmed':
            setApiError('Please verify your email address before signing in.');
            break;
          case 'Too many requests':
            setApiError('Too many attempts. Please wait a moment and try again.');
            break;
          default:
            setApiError(error.message ?? 'Login failed. Please try again.');
        }
        return;
      }

      if (!data?.user) {
        setApiError('Login failed. Please try again.');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', data.user.id)
        .single();

      if (!profile?.name || profile.name === 'Student') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }

    } catch (err: any) {
      setApiError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue your streak</Text>

      {apiError ? (
        <View style={styles.apiErrorBox}>
          <Text style={styles.apiErrorIcon}>⚠</Text>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      ) : null}

      <AuthInput
        label="Email Address"
        placeholder="your@email.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setApiError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
      />

      <AuthInput
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setApiError(null);
        }}
        secureTextEntry
        error={errors.password}
      />

      <AuthButton
        label={loading ? 'Signing in...' : 'Sign In →'}
        onPress={handleLogin}
        loading={loading}
        disabled={submitted && hasErrors}
        style={styles.submitBtn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Don't have an account? </Text>
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
  apiErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
    marginTop: 1,
  },
  apiErrorText: {
    flex: 1,
    color: '#FF4757',
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
