import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

const NATIVE_REDIRECT_URI = makeRedirectUri({
  path: 'auth/callback',
});

const handledCallbackUrls = new Set<string>();

export function getGoogleRedirectUri() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return NATIVE_REDIRECT_URI;
}

export function isGoogleOAuthCallbackUrl(url: string) {
  return url.includes('/auth/callback') || url.includes('://auth/callback');
}

/** Complete either an implicit-flow token callback or a PKCE code callback. */
export async function completeGoogleOAuthCallback(url: string) {
  if (handledCallbackUrls.has(url)) return false;

  const { params, errorCode } = QueryParams.getQueryParams(url);
  const providerError = params.error_description || params.error;
  if (errorCode || providerError) {
    throw new Error(providerError || errorCode || 'Google sign-in failed.');
  }

  if (!params.code && !params.access_token) return false;
  handledCallbackUrls.add(url);

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }

  if (!params.access_token || !params.refresh_token) {
    throw new Error('Google sign-in returned an incomplete session. Please try again.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (error) throw error;
  return true;
}

export async function signInWithGoogle() {
  const redirectTo = getGoogleRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // Web redirects in the current tab; native uses the in-app browser session below.
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) throw error;
  if (Platform.OS === 'web') return;
  if (!data.url) throw new Error('Google sign-in could not start.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google sign-in was cancelled.');
  }
  if (result.type !== 'success') {
    throw new Error('Google sign-in did not complete. Please try again.');
  }

  await completeGoogleOAuthCallback(result.url);
}
