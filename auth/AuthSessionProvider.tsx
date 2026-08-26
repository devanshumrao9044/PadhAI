import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/features/core/services/supabase';

export const GOOGLE_REDIRECT_URI = 'padhai://auth/callback';

function parseOAuthParams(url: string): Record<string, string> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  return `${query}&${hash}`.split('&').reduce<Record<string, string>>((params, pair) => {
    if (!pair) return params;
    const separator = pair.indexOf('=');
    const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
    const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';
    try {
      params[decodeURIComponent(rawKey.replace(/\+/g, ' '))] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Ignore malformed callback fragments and let the missing-token check report a safe error.
    }
    return params;
  }, {});
}

async function createSessionFromOAuthUrl(url: string): Promise<Session | null> {
  const params = parseOAuthParams(url);
  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error);
  }
  if (!params.access_token) return null;
  if (!params.refresh_token) throw new Error('Google sign-in returned an incomplete session. Please try again.');

  const { data, error } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (error) throw error;
  return data.session;
}

type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  signingOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (name: string, email: string, password: string, referralCode?: string) => Promise<{ requiresEmailConfirmation: boolean; email: string }>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const authEventVersion = useRef(0);
  const googleSignInInFlightRef = useRef(false);
  const oauthCallbackInFlightRef = useRef<string | null>(null);
  const handledOAuthCallbackRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const authEventAtHydration = authEventVersion.current;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventVersion.current += 1;
      if (!mounted) return;
      if (event === 'SIGNED_OUT') setSigningOut(false);
      setSession(nextSession);
      setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session: savedSession } }) => {
      if (!mounted) return;
      if (authEventVersion.current === authEventAtHydration) setSession(savedSession);
      setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });
    if (error) throw error;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      throw new Error('Please verify your email address before signing in.');
    }
  }, []);

  const handleOAuthCallback = useCallback(async (url: string): Promise<Session | null> => {
    if (!url.includes('auth/callback')) return null;
    if (handledOAuthCallbackRef.current === url || oauthCallbackInFlightRef.current) return null;
    oauthCallbackInFlightRef.current = url;
    try {
      const session = await createSessionFromOAuthUrl(url);
      handledOAuthCallbackRef.current = url;
      return session;
    } finally {
      oauthCallbackInFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const receiveOAuthUrl = (url: string) => {
      if (mounted) void handleOAuthCallback(url).catch(() => undefined);
    };
    void Linking.getInitialURL().then(url => {
      if (url) receiveOAuthUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => receiveOAuthUrl(url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleOAuthCallback]);

  const signInWithGoogle = useCallback(async () => {
    if (googleSignInInFlightRef.current) return;
    googleSignInInFlightRef.current = true;
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { queryParams: { access_type: 'offline', prompt: 'select_account' } },
        });
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: GOOGLE_REDIRECT_URI,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in is not configured yet.');
      let authorizeUrl: URL;
      try {
        authorizeUrl = new URL(data.url);
      } catch {
        throw new Error('Google sign-in returned an invalid authorization URL.');
      }
      if (authorizeUrl.searchParams.get('redirect_to') !== GOOGLE_REDIRECT_URI) {
        throw new Error('Google redirect is not configured for the PadhAI app. Add padhai://auth/callback in Supabase Redirect URLs.');
      }
      const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
      const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URI);
      if (result.type !== 'success') {
        throw new Error(result.type === 'cancel' ? 'Google sign-in was cancelled.' : 'Google sign-in was dismissed.');
      }
      const session = await handleOAuthCallback(result.url);
      if (!session) throw new Error('Google sign-in did not return a session. Please try again.');
    } finally {
      googleSignInInFlightRef.current = false;
    }
  }, [handleOAuthCallback]);

  const signUp = useCallback(async (
    name: string,
    email: string,
    password: string,
    referralCode = '',
  ) => {
    const normalizedReferralCode = referralCode.trim().toUpperCase();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      options: {
        data: {
          name: name.trim(),
          ...(normalizedReferralCode
            ? { referral_code: normalizedReferralCode }
            : {}),
        },
      },
    });
    if (error) throw error;

    const normalizedEmail = email.trim().toLowerCase();
    const requiresEmailConfirmation = !data.session || !data.user?.email_confirmed_at;
    if (requiresEmailConfirmation && data.session) {
      await supabase.auth.signOut();
    }

    return { requiresEmailConfirmation, email: normalizedEmail };
  }, []);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'padhai://reset-password',
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    authEventVersion.current += 1;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      throw error;
    }
    // Clear local session immediately; the listener also confirms this state.
    setSession(null);
  }, [signingOut]);

  return (
    <AuthContext.Provider value={{
      session,
      ready,
      signingOut,
      signIn,
      signInWithGoogle,
      signUp,
      resendSignupConfirmation,
      sendPasswordReset,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  return context;
}

