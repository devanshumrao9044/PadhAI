import { useState } from 'react';
import {
  View, Text, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 🚀 Yahan humne barrel export import kar liya hai
import { LoginForm, SignupForm } from '@/components/auth';

export default function AuthScreen() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>पढ़</Text>
            <Text style={styles.logoAI}>AI</Text>
          </View>
          <Text style={styles.tagline}>
            "Stay Focused. Study Hard. No Excuses."
          </Text>

          {showLogin
            ? <LoginForm onSwitchToSignup={() => setShowLogin(false)} />
            : <SignupForm onSwitchToLogin={() => setShowLogin(true)} />
          }

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  logoAI: {
    fontSize: 56,
    fontWeight: '900',
    color: '#7C5CFC',
    includeFontPadding: false,
  },
  tagline: {
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.3,
  },
});
