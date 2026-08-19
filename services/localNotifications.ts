import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { readUserCache, writeUserCache } from '@/services/cache';
import type { NotificationSettings } from '@/types/models';

export type NotificationLanguage = 'en' | 'hi';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  studyReminder: true,
  todoReminder: true,
  streakReminder: true,
  studyReminderTime: '18:00',
  streakReminderTime: '21:00',
};

const CHANNEL_IDS = {
  study: 'padhai-study-reminders',
  todo: 'padhai-todo-reminders',
  streak: 'padhai-streak-reminders',
} as const;

const COPY = {
  en: {
    studyTitle: 'PadhAI study reminder',
    studyBody: 'A focused study session today can keep your progress moving.',
    todoTitle: 'PadhAI To-Do reminder',
    todoBody: 'You have unfinished tasks waiting in your To-Do list.',
    streakTitle: 'Protect your PadhAI streak',
    streakBody: 'Complete your study session before the day ends to keep your streak alive.',
  },
  hi: {
    studyTitle: 'PadhAI पढ़ाई reminder',
    studyBody: 'आज का focused study session आपकी progress बनाए रख सकता है।',
    todoTitle: 'PadhAI To-Do reminder',
    todoBody: 'आपकी To-Do list में कुछ tasks अभी पूरे नहीं हुए हैं।',
    streakTitle: 'अपनी PadhAI streak बचाएँ',
    streakBody: 'Streak बनाए रखने के लिए दिन खत्म होने से पहले study session पूरा करें।',
  },
} satisfies Record<NotificationLanguage, Record<string, string>>;

let handlerConfigured = false;

function configureHandler() {
  if (handlerConfigured || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

export async function loadNotificationSettings(userId: string): Promise<NotificationSettings> {
  const cached = await readUserCache<Partial<NotificationSettings>>(userId, 'notificationSettings');
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(cached?.data ?? {}) };
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
  await writeUserCache(userId, 'notificationSettings', settings);
}

function parseTime(value: string, fallback: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  if (
    Number.isInteger(hour) && hour >= 0 && hour <= 23 &&
    Number.isInteger(minute) && minute >= 0 && minute <= 59
  ) {
    return { hour, minute };
  }
  const [fallbackHour, fallbackMinute] = fallback.split(':').map(Number);
  return { hour: fallbackHour, minute: fallbackMinute };
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  configureHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.study, {
      name: 'Study reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.todo, {
      name: 'To-Do reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 200],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.streak, {
      name: 'Streak reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      sound: 'default',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function cancelPadhaiReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(item => item.content.data && (item.content.data as { padhaiLocal?: boolean }).padhaiLocal)
      .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

async function scheduleDailyReminder(
  title: string,
  body: string,
  time: string,
  channelId: string,
  kind: string,
): Promise<void> {
  const { hour, minute } = parseTime(time, '18:00');
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { padhaiLocal: true, kind },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
      channelId,
    },
  });
}

export async function syncLocalNotifications(
  settings: NotificationSettings,
  language: NotificationLanguage,
  hasPendingTodo = false,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await cancelPadhaiReminders();
  if (!settings.enabled) return true;
  if (!settings.studyReminder && !settings.todoReminder && !settings.streakReminder) return true;
  if (!(await ensurePermission())) return false;

  const copy = COPY[language];
  if (settings.studyReminder) {
    await scheduleDailyReminder(
      copy.studyTitle,
      copy.studyBody,
      settings.studyReminderTime,
      CHANNEL_IDS.study,
      'study',
    );
  }
  if (settings.todoReminder && hasPendingTodo) {
    await scheduleDailyReminder(
      copy.todoTitle,
      copy.todoBody,
      '20:00',
      CHANNEL_IDS.todo,
      'todo',
    );
  }
  if (settings.streakReminder) {
    await scheduleDailyReminder(
      copy.streakTitle,
      copy.streakBody,
      settings.streakReminderTime,
      CHANNEL_IDS.streak,
      'streak',
    );
  }
  return true;
}

export async function clearLocalNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelPadhaiReminders();
}
