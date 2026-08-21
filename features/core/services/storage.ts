import { Platform } from 'react-native';

function getStorage() {
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
  return {
    getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}

const storage = getStorage();

const KEYS = {
  USER: 'padhai_user',
  SUBJECTS: 'padhai_subjects',
  CHAPTERS: 'padhai_chapters',
  TOPICS: 'padhai_topics',
  SESSIONS: 'padhai_sessions',
  DAILY_SUMMARY: 'padhai_daily_summary',
  XP_LOG: 'padhai_xp_log',
  ONBOARDED: 'padhai_onboarded',
  ACTIVE_SESSION: 'padhai_active_session',
  LANGUAGE: 'padhai_language_v1',
  FOCUS_GUARD_ALLOWED_APPS: 'padhai_focus_guard_allowed_apps_v1',
};

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const val = await storage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await storage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  try {
    await storage.removeItem(key);
  } catch {}
}

export const StorageKeys = KEYS;
