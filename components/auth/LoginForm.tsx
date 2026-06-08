import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';

interface Props {
  onSwitchToSignup: () => void;
}

interface Errors {
  email?: string;
  password?: string;
}

export default function LoginForm({ onSwitchToSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function validate(): boolean {
    const newErrors: Errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    
    if (!password.trim()) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password Must be at least 6 characters';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (authError) {
        if (authError.message === 'Email not confirmed') {
          Alert.alert('Verify Email', 'Please verify your email to login.');
        } else if (authError.message === 'Invalid login credentials') {
          Alert.alert('Login Failed', 'Invalid email or password.');
        } else {
          Alert.alert('Login Failed', authError.message);
        }
        return;
      }

      if (!authData?.user) {
        Alert.alert('Error', 'Login failed. Please try again.');
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
      Alert.alert('Error', error.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Welcome Back 👋</Text>
      <Text style={styles.subtitle}>Login to continue</Text>

      <AuthInput
        label="Email"
        placeholder="your@email.com"
        value={email}
        onChangeText={(t) => { setEmail(t); setErrors(p => ({ ...p, email: undefined })); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
      />

      <AuthInput
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={(t) => { setPassword(t); setErrors(p => ({ ...p, password: undefined })); }}
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
        <TouchableOpacity onPress={onSwitchToSignup} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
    marginBottom: 24,
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
