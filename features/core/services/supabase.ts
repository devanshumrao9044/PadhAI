import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

// This project is a direct Expo client for native and static web builds. The
// @supabase/ssr cookie model requires a server runtime that can set and refresh
// HttpOnly cookies; adding it here would not create HttpOnly cookies and would
// break the native client. Treat RLS and server-side RPC authorization as the
// security boundary until a separate server-rendered web app is introduced.
function makeStorage() {
  if (Platform.OS !== 'web') {
    return require('@react-native-async-storage/async-storage').default;
  }
  if (typeof window === 'undefined') {
    return {
      getItem: (_key: string) => Promise.resolve(null),
      setItem: (_key: string, _value: string) => Promise.resolve(),
      removeItem: (_key: string) => Promise.resolve(),
    };
  }
  // Supabase's browser client needs this storage adapter to persist a SPA
  // session. It is intentionally not described as HttpOnly protection: any
  // true HttpOnly migration requires a server-side web architecture.
  return {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: makeStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
