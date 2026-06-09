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

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  function validate(): FormErrors {
    const e: FormErrors = {};

    if (!name.trim()) {
      e.name = 'Enter Your Name';
    } else if (name.trim().length < 3) {
      e.name = 'The name should be at least 3 letters';
    }

    if (!email.trim()) {
      e.email = 'Enter you Email';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      e.email = 'Enter Valid Email';
    }

    if (!password.trim()) {
      e.password = 'Enter the password';
    } else if (password.trim().length < 6) {
      e.password = 'Password should be at least 6 characters.';
    }

    return e;
  }

  async function handleSignup() {
    setApiError(null);
    setApiSuccess(null);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const { data: signupData, error: signupError } =
        await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: password.trim(),
          options: { data: { name: name.trim() } },
        });

      if (signupError) {
        if (signupError.message.includes('already registered')) {
          setApiError('Already registered your Email. Login Now.');
        } else {
          setApiError(signupError.message);
        }
        return;
      }

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
        setApiSuccess('Account Created Successfully ✅ Confirm email.');
      }

    } catch (error: any) {
      setApiError(error.message || 'Something went wrong. Try Again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Join PadhAI 🎯</Text>
      <Text style={styles.subtitle}>Focus Your mind.</Text>

      {!!apiError && (
        <View style={styles.apiErrorBox}>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      )}

      {!!apiSuccess && (
        <View style={styles.apiSuccessBox}>
          <Text style={styles.apiSuccessText}>{apiSuccess}</Text>
        </View>
      )}

      <AuthInput
        label="Naam"
        placeholder="Devansh "
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (errors.name) setErrors(p => ({ ...p, name: undefined }));
          if (apiError) setApiError(null);
        }}
        autoCapitalize="words"
        error={errors.name}
      />

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
        label="Create Account →"
        onPress={handleSignup}
        loading={loading}
        style={styles.btn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <TouchableOpacity
          onPress={onSwitchToLogin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
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
  apiSuccessBox: {
    backgroundColor: 'rgba(76, 175, 125, 0.1)',
    borderWidth: 1,
    borderColor: '#4CAF7D',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  apiSuccessText: {
    color: '#4CAF7D',
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
