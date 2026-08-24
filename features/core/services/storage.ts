import { Platform } from 'react-native';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryStore = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: async (key) => memoryStore.get(key) ?? null,
  setItem: async (key, value) => { memoryStore.set(key, value); },
  removeItem: async (key) => { memoryStore.delete(key); },
};

let storage: StorageLike | undefined;

function getStorage(): StorageLike {
  if (storage) return storage;

  if (Platform.OS !== 'web') {
    try {
      const candidate = require('@react-native-async-storage/async-storage').default as Partial<StorageLike> | undefined;
      if (
        candidate &&
        typeof candidate.getItem === 'function' &&
        typeof candidate.setItem === 'function' &&
        typeof candidate.removeItem === 'function'
      ) {
        storage = candidate as StorageLike;
        return storage;
      }
    } catch {
      // Keep startup alive if the native storage module is unavailable on a device.
    }
    storage = memoryStorage;
    return storage;
  }

  if (typeof window === 'undefined') {
    storage = memoryStorage;
    return storage;
  }

  storage = {
    getItem: async (key) => window.localStorage.getItem(key),
    setItem: async (key, value) => { window.localStorage.setItem(key, value); },
    removeItem: async (key) => { window.localStorage.removeItem(key); },
  };
  return storage;
}

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
};

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const val = await getStorage().getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await getStorage().setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  try {
    await getStorage().removeItem(key);
  } catch {}
}

export const StorageKeys = KEYS;

export function resetStorageForTests(): void {
  storage = undefined;
  memoryStore.clear();
}
