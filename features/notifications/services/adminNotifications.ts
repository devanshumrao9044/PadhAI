import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/features/core/services/supabase';
import {
  NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES,
  NOTIFICATION_MAX_PDF_BYTES,
} from '@/features/notifications/services/notificationAttachmentsPolicy';
import type { PreparedNotificationAttachment } from '@/features/notifications/services/notificationAttachments';

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
  attachmentPath: string | null;
  attachmentMimeType: 'image/jpeg' | 'application/pdf' | null;
  attachmentSizeBytes: number | null;
  linkUrl: string | null;
};

export type NotificationAttachmentInput = {
  path: string;
  mimeType: 'image/jpeg' | 'application/pdf';
  sizeBytes: number;
};

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function mapNotification(row: any): UserNotification {
  return {
    id: row.id,
    messageId: row.message_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
    attachmentPath: row.attachment_path ?? null,
    attachmentMimeType: row.attachment_mime_type ?? null,
    attachmentSizeBytes: row.attachment_size_bytes ?? null,
    linkUrl: row.link_url ?? null,
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
  attachment?: NotificationAttachmentInput;
  linkUrl?: string;
}): Promise<{ messageId: string; recipientCount: number; deviceCount: number; sent: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke('send-admin-notification', {
    body: {
      ...input,
      attachmentPath: input.attachment?.path,
      attachmentMimeType: input.attachment?.mimeType,
      attachmentSizeBytes: input.attachment?.sizeBytes,
      attachment: undefined,
    },
  });
  if (error) throw error;
  return data as { messageId: string; recipientCount: number; deviceCount: number; sent: number; failed: number };
}

export async function loadUserNotifications(): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,message_id,title,body,created_at,read_at,attachment_path,attachment_mime_type,attachment_size_bytes,link_url')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export function subscribeToUserNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`user-notifications-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_notifications',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function loadUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .limit(1);
  if (error) throw error;
  return count ?? 0;
}

export async function markUserNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteUserNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function randomAttachmentId(): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadNotificationAttachment(userId: string, attachment: PreparedNotificationAttachment): Promise<NotificationAttachmentInput> {
  const expectedLimit = attachment.mimeType === 'image/jpeg'
    ? NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES
    : NOTIFICATION_MAX_PDF_BYTES;
  if (attachment.body.byteLength < 1 || attachment.sizeBytes !== attachment.body.byteLength || attachment.sizeBytes > expectedLimit) {
    throw new Error('Attachment exceeds the allowed compressed size. Please choose a smaller file.');
  }
  if (
    (attachment.mimeType === 'image/jpeg' && attachment.extension !== 'jpg')
    || (attachment.mimeType === 'application/pdf' && attachment.extension !== 'pdf')
  ) {
    throw new Error('Attachment type does not match its file extension.');
  }
  const path = `${userId}/${randomAttachmentId()}.${attachment.extension}`;
  const { error } = await supabase.storage
    .from('notification-attachments')
    .upload(path, attachment.body, {
      contentType: attachment.mimeType,
      cacheControl: '86400',
      upsert: false,
    });
  if (error) throw new Error('Attachment upload failed.');
  return { path, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes };
}

export async function deleteNotificationAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('notification-attachments')
    .remove([path]);
  if (error) throw error;
  signedUrlCache.delete(path);
}

export async function getNotificationAttachmentUrl(path: string): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now + 120_000) return cached.url;

  const { data, error } = await supabase.storage
    .from('notification-attachments')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error('Attachment link could not be created.');
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: now + 3600_000 });
  return data.signedUrl;
}

export async function openNotificationAttachment(path: string): Promise<void> {
  await Linking.openURL(await getNotificationAttachmentUrl(path));
}

export async function openNotificationLink(url: string): Promise<void> {
  await Linking.openURL(url);
}

export async function registerNotificationDevice(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? (Constants as any).easConfig?.projectId
      ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted
      ? current
      : await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: false, allowSound: true },
        });
    if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return false;

    const token = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase.from('notification_devices').upsert({
      user_id: userId,
      expo_push_token: token.data,
      platform,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'expo_push_token' });
    return !error;
  } catch (error) {
    console.warn('Notification device registration failed', error);
    return false;
  }
}

export async function disableNotificationDevice(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notification_devices')
    .update({ enabled: false, last_seen_at: new Date().toISOString() })
    .eq('user_id', userId);
  return !error;
}
