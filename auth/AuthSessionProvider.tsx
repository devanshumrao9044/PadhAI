import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/features/core/services/supabase';

type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  signingOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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

