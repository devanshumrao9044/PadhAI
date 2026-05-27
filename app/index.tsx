import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Enter both email and password ');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        // 1. data aur error dono ko fetch kiya taaki data.user.id mil sake
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email, password
        });
        if (authError) throw authError;

        if (authData?.user) {
          // 2. Database se user ka name profile check kiya
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('name')
            .eq('id', authData.user.id)
            .single();

          // 3. Agar name set nahi hai ya 'Student' hai to onboarding, nahi to direct tabs
          if (!profile?.name || profile.name === 'Student') {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        }
      } else {
        if (!name) {
          Alert.alert('Error',' type your name ');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } }
        });
        if (error) throw error;
        Alert.alert('Successful!', 'Account created! Log in now .');
        setIsLogin(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>पढ़</Text>
          <Text style={styles.logoAI}>AI</Text>
        </View>
        <Text style={styles.tagline}>“Stay Focused. Study hard. No excuses</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>
            {isLogin ? 'Welcome Back 👋' : 'Join PadhAI 🎯'}
          </Text>

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>
                  {isLogin ? 'Login →' : 'Sign-Up →'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.switchText}>
              {isLogin
                ? ' Sign Up '
                : 'Already have an account? Login '}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  logoAI: {
    fontSize: 52,
    fontWeight: '900',
    color: '#6B21A8',
  },
  tagline: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2D2D2D',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: {
    backgroundColor: '#6B21A8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    color: '#6B21A8',
    textAlign: 'center',
    fontSize: 14,
  },
});
