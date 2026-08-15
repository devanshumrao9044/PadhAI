import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { applyReferralCode } from '@/services/referralService';

type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  signingOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, referralCode?: string) => Promise<{ requiresEmailConfirmation: boolean }>;
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
  }, []);

  const signUp = useCallback(async (
    name: string,
    email: string,
    password: string,
    referralCode = '',
  ) => {
    const normalizedReferralCode = referralCode.trim().toUpperCase();
    if (normalizedReferralCode) {
      const { data: isValid, error: validationError } = await supabase.rpc(
        'validate_referral_code',
        { code: normalizedReferralCode },
      );
      if (validationError) throw validationError;
      if (!isValid) {
        throw new Error('Invalid referral code. Please check it and try again.');
      }
    }

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

    if (data.user && normalizedReferralCode && data.session) {
      await applyReferralCode(data.user.id, normalizedReferralCode);
    }

    return { requiresEmailConfirmation: !data.session };
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

