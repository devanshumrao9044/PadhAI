import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';

interface Props {
  onSwitchToLogin: () => void;
}

interface Errors {
  name?: string;
  email?: string;
  password?: string;
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function validate(): boolean {
    const newErrors: Errors = {};
    if (!name.trim() || name.trim().length < 3)
      newErrors.name = 'Name must be at least 3 characters';
      
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    
    if (!password.trim()) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Must be at least 6 characters';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignup() {
    if (!validate()) return;
    setLoading(true);
    
    try {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: { data: { name: name.trim() } },
      });

      if (signupError) {
        if (signupError.message.includes('already registered')) {
          Alert.alert('Already Registered', 'This email is already in use. Please login.');
        } else {
          Alert.alert('Signup Failed', signupError.message);
        }
        return;
      }

      // If email confirmation is OFF — direct login
      if (signupData?.session) {
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', signupData.user!.id)
          .single();

        if (!profile?.name || profile.name === 'Student') {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        // If email confirmation is ON
        Alert.alert(
          'Account Created ✅',
          'Please verify your email to login.',
          [{ text: 'OK', onPress: onSwitchToLogin }]
        );
      }

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Join PadhAI 🎯</Text>
      <Text style={styles.subtitle}>Start tracking your studies today</Text>

      <AuthInput
        label="Name"
        placeholder="Your full name"
        value={name}
        onChangeText={(t) => { setName(t); setErrors(p => ({ ...p, name: undefined })); }}
        autoCapitalize="words"
        error={errors.name}
      />

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
        label="Create Account →"
        onPress={handleSignup}
        loading={loading}
        style={styles.btn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <TouchableOpacity onPress={onSwitchToLogin} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.switchLink}>Log In</Text>
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
