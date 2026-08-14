import { useState } from 'react';
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

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, sendPasswordReset } = useAuthSession();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const submit = async () => {
    clearFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mode !== 'forgot' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(normalizedEmail, password);
        router.replace('/(tabs)');
      } else if (mode === 'signup') {
        const result = await signUp(name, normalizedEmail, password, referralCode);
        if (result.requiresEmailConfirmation) {
          setMessage('Account created. Please verify your email, then sign in.');
          setMode('login');
        }
      } else {
        await sendPasswordReset(normalizedEmail);
        setMessage('Reset link sent. Please check your email.');
      }
    } catch (submitError: any) {
      setError(submitError?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password';
  const buttonLabel = mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>पढ़<Text style={styles.logoAccent}>AI</Text></Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Focus your mind. Build your future.</Text>

          {mode === 'signup' ? (
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#737384" value={name} onChangeText={setName} />
          ) : null}
          <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#737384" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
          {mode === 'signup' ? (
            <TextInput style={styles.input} placeholder="Referral code (optional)" placeholderTextColor="#737384" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
          ) : null}
          {mode !== 'forgot' ? (
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#737384" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{buttonLabel}</Text>}
          </Pressable>

          {mode === 'login' ? (
            <Pressable onPress={() => { clearFeedback(); setMode('forgot'); }} style={styles.secondaryAction}>
              <Text style={styles.secondaryText}>Forgot password?</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              clearFeedback();
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryText}>{mode === 'login' ? 'Create a new account' : 'Back to sign in'}</Text>
          </Pressable>

          {mode === 'forgot' ? (
            <Pressable onPress={() => { clearFeedback(); setMode('login'); }} style={styles.secondaryAction}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: '#FFFFFF', fontSize: 56, fontWeight: '900', textAlign: 'center' },
  logoAccent: { color: '#7C5CFC' },
  title: { color: '#F1F1F6', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 24 },
  subtitle: { color: '#9CA3AF', fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  input: { backgroundColor: '#151521', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: 1, color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 15, marginBottom: 12 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryAction: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: '#B5A6FF', fontSize: 14, fontWeight: '600' },
  error: { color: '#FF6675', lineHeight: 20, textAlign: 'center', marginVertical: 12 },
  message: { color: '#44D39A', lineHeight: 20, textAlign: 'center', marginVertical: 12 },
});
