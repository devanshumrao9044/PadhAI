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

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginForm({ onSwitchToSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  function validate(): FormErrors {
    const e: FormErrors = {};

    if (!email.trim()) {
      e.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      e.email = 'Enter a valid email';
    }

    if (!password.trim()) {
      e.password = 'Enter the password';
    } else if (password.trim().length < 6) {
      e.password = 'Password should be at least 6 characters';
    }

    return e;
  }

  async function handleLogin() {
    setApiError(null);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        });

      if (authError) {
        if (authError.message === 'Email not confirmed') {
          setApiError('Please confirm your email.');
        } else if (authError.message === 'Invalid login credentials') {
          setApiError('Email or password is incorrect.');
        } else {
          setApiError(authError.message);
        }
        return;
      }

      if (!authData?.user) {
        setApiError('I was not able to log in.Try again.');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', authData.user.id)
        .single();

      if (!profile?.name || profile.name === 'Student') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }

    } catch (error: any) {
      setApiError(error.message || 'Something went wrong.Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Welcome Back 👋</Text>
      <Text style={styles.subtitle}>Login to continue</Text>

      {!!apiError && (
        <View style={styles.apiErrorBox}>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      )}

      <AuthInput
        label="Email"
        placeholder="your@email.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (errors.email) setErrors(p => ({ ...p, email: undefined }));
          if (apiError) setApiError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
      />

      <AuthInput
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.password) setErrors(p => ({ ...p, password: undefined }));
          if (apiError) setApiError(null);
        }}
        secureTextEntry
        error={errors.password}
      />

      <AuthButton
        label="Login →"
        onPress={handleLogin}
        loading={loading}
        style={styles.btn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Don't have an account? </Text>
        <TouchableOpacity
          onPress={onSwitchToSignup}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.switchLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#12121A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    color: '#F1F1F6',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    includeFontPadding: false,
  },
  subtitle: {
    color: '#55556A',
    fontSize: 13,
    marginBottom: 16,
  },
  apiErrorBox: {
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderWidth: 1,
    borderColor: '#FF4757',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  apiErrorText: {
    color: '#FF4757',
    fontSize: 13,
    fontWeight: '600',
  },
  btn: {
    marginTop: 6,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#55556A',
    fontSize: 13,
  },
  switchLink: {
    color: '#7C5CFC',
    fontSize: 13,
    fontWeight: '700',
  },
});
