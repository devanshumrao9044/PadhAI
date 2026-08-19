import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/services/supabase';

export type NotificationRecipient = {
  id: string;
  name: string | null;
  email: string | null;
  level: number | null;
};

export type AdminNotificationTarget = 'user' | 'all' | 'level';

export type UserNotification = {
  id: string;
  messageId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

function mapNotification(row: any): UserNotification {
  return {
    id: row.id,
    messageId: row.message_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
  };
}

export async function isNotificationAdmin(userId: string): Promise<{ allowed: boolean; role: 'owner' | 'admin' | null }> {
  const { data, error } = await supabase
    .from('notification_admins')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || (data.role !== 'owner' && data.role !== 'admin')) return { allowed: false, role: null };
  return { allowed: true, role: data.role };
}

export async function loadAdminRecipients(): Promise<NotificationRecipient[]> {
  const { data, error } = await supabase.functions.invoke('send-admin-notification', { method: 'GET' });
  if (error) throw error;
  return (data?.recipients ?? []) as NotificationRecipient[];
}

export async function sendAdminNotification(input: {
  title: string;
  body: string;
  targetType: AdminNotificationTarget;
  targetUserId?: string;
  targetLevel?: number;
}): Promise<{ messageId: string; recipientCount: number; deviceCount: number; sent: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke('send-admin-notification', { body: input });
  if (error) throw error;
  return data as { messageId: string; recipientCount: number; deviceCount: number; sent: number; failed: number };
}

export async function loadUserNotifications(): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,message_id,title,body,created_at,read_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markUserNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function registerNotificationDevice(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) return false;

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      });
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return false;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await supabase.from('notification_devices').upsert({
    user_id: userId,
    expo_push_token: token.data,
    platform,
    enabled: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'expo_push_token' });
  return !error;
}
