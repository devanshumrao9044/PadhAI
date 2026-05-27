import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER: 'ziddi_user',
  SUBJECTS: 'ziddi_subjects',
  CHAPTERS: 'ziddi_chapters',
  TOPICS: 'ziddi_topics',
  SESSIONS: 'ziddi_sessions',
  DAILY_SUMMARY: 'ziddi_daily_summary',
  XP_LOG: 'ziddi_xp_log',
  ONBOARDED: 'ziddi_onboarded',
  ACTIVE_SESSION: 'ziddi_active_session',
};

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export const StorageKeys = KEYS;
