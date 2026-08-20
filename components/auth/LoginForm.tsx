// LEGACY AUTH FILE — NOT USED BY THE ACTIVE ROUTE TREE.
// The active auth path is auth/AuthScreen.tsx + auth/AuthSessionProvider.tsx.
// Do not add new authentication logic here.

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/features/core/services/supabase';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/constants/translations';

interface Props {
  onSwitchToSignup: () => void;
}

type Mode = 'login' | 'forgot';

type Translate = (key: TranslationKey) => string;

function getLoginErrors(email: string, password: string, t: Translate) {
  const errors: { email?: string; password?: string } = {};
  if (!email.trim()) {
    errors.email = t('auth.emailRequired');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = t('auth.emailInvalid');
  }
  if (!password.trim()) {
    errors.password = t('auth.passwordRequired');
  } else if (password.length < 6) {
    errors.password = t('auth.passwordMin');
  }
  return errors;
}

function getForgotErrors(email: string, t: Translate) {
  const errors: { email?: string } = {};
  if (!email.trim()) {
    errors.email = t('auth.emailRequired');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = t('auth.emailInvalid');
  }
  return errors;
}

export default function LoginForm({ onSwitchToSignup }: Props) {
  const { t } = useLanguage();
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
  const loginErrors = loginSubmitted ? getLoginErrors(email, password, t) : {};
  const loginHasErrors = Object.keys(loginErrors).length > 0;

  // Forgot errors — computed during render
  const forgotErrors = forgotSubmitted ? getForgotErrors(forgotEmail, t) : {};

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

  // ── Login handler ──────────────────────────────────────────────────────────
  async function handleLogin() {
    setLoginSubmitted(true);
    setLoginApiError(null);

    if (Object.keys(getLoginErrors(email, password, t)).length > 0) return;

    setLoginLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('invalid login') ||
          error.message.toLowerCase().includes('invalid credentials') ||
          error.message.toLowerCase().includes('wrong password')
        ) {
          setLoginApiError(t('auth.incorrectCredentials'));
        } else {
          setLoginApiError(error.message ?? t('auth.signInFailed'));
        }
        return;
      }

      if (data?.session) {
        if (!data.user?.email_confirmed_at) {
          await supabase.auth.signOut();
          setLoginApiError(t('auth.verifyEmail'));
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', data.user!.id)
          .single();

        if (!profile?.name || profile.name === 'Student') {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      setLoginApiError(err?.message ?? t('auth.unexpected'));
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Forgot password handler ────────────────────────────────────────────────
  async function handleForgotPassword() {
    setForgotSubmitted(true);
    setForgotApiError(null);
    setForgotSuccess(null);

    if (Object.keys(getForgotErrors(forgotEmail, t)).length > 0) return;

    setForgotLoading(true);
    try {
      const trimmedEmail = forgotEmail.trim().toLowerCase();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo: 'padhai://reset-password' }
      );

      if (resetError) {
        const resetMessage = resetError.message.toLowerCase();
        setForgotApiError(resetMessage.includes('rate') || resetMessage.includes('too many')
          ? t('auth.tooManyRequests')
          : t('auth.resetFailed'));
        return;
      }

      setForgotSuccess(
        t('auth.resetSent', { value: trimmedEmail })
      );
    } catch (err: any) {
      setForgotApiError(err?.message ?? t('auth.unexpected'));
    } finally {
      setForgotLoading(false);
    }
  }

  // ── FORGOT PASSWORD VIEW ───────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          onPress={switchToLogin}
          style={styles.backRow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>{'←'}</Text>
          <Text style={styles.backText}>{t('auth.backToSignIn')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.resetPassword')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetSubtitle')}</Text>

        {forgotApiError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>{'⚠ '}</Text>
            <Text style={styles.errorBoxText}>{forgotApiError}</Text>
          </View>
        ) : null}

        {forgotSuccess ? (
          <View style={styles.successBox}>
            <Text style={styles.successBoxIcon}>{'✓ '}</Text>
            <Text style={styles.successBoxText}>{forgotSuccess}</Text>
          </View>
        ) : null}

        {!forgotSuccess ? (
          <>
            <AuthInput
              label={t('auth.emailAddress')}
              placeholder={t('auth.emailPlaceholder')}
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
              label={forgotLoading ? t('auth.sending') : t('auth.sendResetLink')}
              onPress={handleForgotPassword}
              loading={forgotLoading}
              style={styles.submitBtn}
            />
          </>
        ) : (
          <AuthButton
            label={t('auth.backToSignIn')}
            onPress={switchToLogin}
            variant="secondary"
            style={styles.submitBtn}
          />
        )}
      </View>
    );
  }

  // ── LOGIN VIEW ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
      <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

      {loginApiError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxIcon}>{'⚠ '}</Text>
          <Text style={styles.errorBoxText}>{loginApiError}</Text>
        </View>
      ) : null}

      <AuthInput
        label={t('auth.emailAddress')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={(t) => { setEmail(t); setLoginApiError(null); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={loginErrors.email}
      />

      <AuthInput
        label={t('auth.password')}
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChangeText={(t) => { setPassword(t); setLoginApiError(null); }}
        secureTextEntry
        error={loginErrors.password}
      />

      <TouchableOpacity
        onPress={switchToForgot}
        style={styles.forgotRow}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
      </TouchableOpacity>

      <AuthButton
        label={loginLoading ? t('auth.signingIn') : t('auth.signIn')}
        onPress={handleLogin}
        loading={loginLoading}
        disabled={loginSubmitted && loginHasErrors}
        style={styles.submitBtn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{t('auth.noAccount')}</Text>
        <TouchableOpacity
          onPress={onSwitchToSignup}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.switchLink}>{t('auth.createAccountLink')}</Text>
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
