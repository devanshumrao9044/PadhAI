import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';
import { getPasswordProviderError, validatePassword } from '@/auth/passwordPolicy';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/constants/translations';

interface Props {
  onSwitchToLogin: () => void;
}

type Translate = (key: TranslationKey) => string;

function getSignupErrors(name: string, email: string, password: string, t: Translate) {
  const errors: {
    name?: string;
    email?: string;
    password?: string;
  } = {};

  if (!name.trim()) {
    errors.name = t('auth.nameRequired');
  } else if (name.trim().length < 3) {
    errors.name = t('auth.nameMin');
  } else if (name.trim().length > 40) {
    errors.name = t('auth.nameMax');
  }

  if (!email.trim()) {
    errors.email = t('auth.emailRequired');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = t('auth.emailInvalid');
  }

  if (!password.trim()) {
    errors.password = t('auth.passwordRequired');
  } else if (password.length > 72) {
    errors.password = t('auth.passwordMax');
  } else {
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) errors.password = passwordResult.error;
  }

  return errors;
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  const errors = submitted ? getSignupErrors(name, email, password, t) : {};
  const hasErrors = Object.keys(errors).length > 0;

  async function handleSignup() {
    setSubmitted(true);
    setApiError(null);
    setApiSuccess(null);

    const currentErrors = getSignupErrors(name, email, password, t);
    if (Object.keys(currentErrors).length > 0) return;

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();
      const normalizedReferralCode = referralCode.trim().toUpperCase();

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          data: {
            name: name.trim(),
            ...(normalizedReferralCode ? { referral_code: normalizedReferralCode } : {}),
          },
        },
      });

      if (signupError) {
        const msg = signupError.message.toLowerCase();
        const passwordProviderError = getPasswordProviderError(signupError.message);
        if (passwordProviderError) {
          setApiError(passwordProviderError);
        } else if (msg.includes('referral code') || (normalizedReferralCode && msg.includes('database error saving new user'))) {
          setApiError(t('auth.invalidReferral'));
        } else if (
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('user already')
        ) {
          setApiError(t('auth.alreadyRegistered'));
        } else {
          setApiError(signupError.message ?? t('auth.signUpFailed'));
        }
        return;
      }

      const signupUser = signupData?.user;

      if (signupData?.session && signupUser && !signupUser.email_confirmed_at) {
        await supabase.auth.signOut();
        setApiSuccess(t('auth.accountCreatedVerify'));
        return;
      }

      if (signupData?.session && signupUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', signupUser.id)
          .single();

        if (!profile?.name || profile.name === 'Student') {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
        return;
      }

      if (signupUser && !signupUser.email_confirmed_at) {
        setApiSuccess(t('auth.accountCreatedVerify'));
        return;
      }

      if (signupUser) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          });

        if (!signInError && signInData?.session) {
          router.replace('/onboarding');
          return;
        }

        if (signInError?.message === 'Email not confirmed') {
          setApiSuccess(t('auth.accountCreatedVerify'));
          return;
        }

        setApiSuccess(t('auth.accountCreatedSignIn'));
        return;
      }

      setApiError(t('auth.somethingWrong'));

    } catch (err: any) {
      setApiError(err?.message ?? t('auth.unexpected'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('auth.createAccount')}</Text>
      <Text style={styles.subtitle}>{t('auth.signupSubtitle')}</Text>

      {apiError ? (
        <View style={styles.apiErrorBox}>
          <Text style={styles.apiErrorIcon}>⚠</Text>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      ) : null}

      {apiSuccess ? (
        <View style={styles.apiSuccessBox}>
          <Text style={styles.apiSuccessIcon}>✓</Text>
          <Text style={styles.apiSuccessText}>{apiSuccess}</Text>
        </View>
      ) : null}

        <AuthInput
        label={t('auth.fullName')}
        placeholder={t('auth.namePlaceholder')}
        value={name}
        onChangeText={(t) => {
          setName(t);
          setApiError(null);
        }}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="name"
        error={errors.name}
      />

      <AuthInput
        label={t('auth.emailAddress')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setApiError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={errors.email}
      />

      <AuthInput
        label={t('auth.password')}
        placeholder={t('auth.passwordSignupPlaceholder')}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setApiError(null);
        }}
        secureTextEntry
        autoComplete="password-new"
        error={errors.password}
      />

      <AuthInput
        label={t('auth.referralOptional')}
        placeholder={t('auth.referralPlaceholder')}
        value={referralCode}
        onChangeText={(t) => setReferralCode(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <AuthButton
        label={loading ? t('auth.creatingAccount') : t('auth.createAccount')}
        onPress={handleSignup}
        loading={loading}
        disabled={submitted && hasErrors}
        style={styles.submitBtn}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{t('auth.alreadyAccount')}</Text>
        <TouchableOpacity
          onPress={onSwitchToLogin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.switchLink}>{t('auth.signIn')}</Text>
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
  apiSuccessBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
    marginTop: 1,
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

