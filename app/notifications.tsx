import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import {
  deleteUserNotification,
  loadUserNotifications,
  markUserNotificationRead,
  openNotificationAttachment,
  openNotificationLink,
  type UserNotification,
} from '@/services/adminNotifications';

function formatAttachmentSize(bytes: number | null): string {
  if (!bytes || bytes < 1) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      setItems(await loadUserNotifications());
    } catch (error: any) {
      Alert.alert(t('notifications.title'), error?.message ?? t('notifications.loadFailed'));
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: UserNotification) => {
    if (item.readAt || busyId) return;
    setBusyId(item.id);
    try {
      await markUserNotificationRead(item.id);
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
    } finally {
      setBusyId(null);
    }
  };

  const remove = (item: UserNotification) => {
    Alert.alert(
      t('notifications.deleteTitle'),
      t('notifications.deleteMessage'),
      [
        { text: t('notifications.cancel'), style: 'cancel' },
        {
          text: t('notifications.deleteAction'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await deleteUserNotification(item.id);
              setItems(current => current.filter(entry => entry.id !== item.id));
            } catch (error: any) {
              Alert.alert(t('notifications.title'), error?.message ?? t('notifications.deleteFailed'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const openAttachment = async (item: UserNotification) => {
    if (!item.attachmentPath) return;
    setBusyId(item.id);
    try {
      await openNotificationAttachment(item.attachmentPath);
    } catch (error: any) {
      Alert.alert(t('notifications.title'), error?.message ?? t('notifications.attachmentFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const openLink = async (item: UserNotification) => {
    if (!item.linkUrl) return;
    try {
      await openNotificationLink(item.linkUrl);
    } catch (error: any) {
      Alert.alert(t('notifications.title'), error?.message ?? t('notifications.linkFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('notifications.title')}</Text>
          <Text style={styles.subtitle}>{t('notifications.inboxDescription')}</Text>
        </View>
        <TouchableOpacity onPress={() => void load(true)} style={styles.refreshButton} accessibilityLabel="Refresh notifications">
          <MaterialIcons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        >
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="notifications-none" size={42} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
            </View>
          ) : items.map(item => {
            const attachmentLabel = item.attachmentMimeType === 'application/pdf' ? t('notifications.pdfAttachment') : t('notifications.imageAttachment');
            return (
              <View key={item.id} style={[styles.notificationCard, !item.readAt && styles.unreadCard]}>
                <TouchableOpacity style={styles.cardMain} onPress={() => void markRead(item)} activeOpacity={0.8}>
                  <View style={styles.iconWrap}>
                    <MaterialIcons name={item.readAt ? 'notifications-none' : 'notifications-active'} size={21} color={item.readAt ? colors.textSecondary : colors.primary} />
                  </View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {!item.readAt ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.itemMessage}>{item.body}</Text>
                    <Text style={styles.itemDate}>{new Date(item.createdAt).toLocaleString()}</Text>
                    {!item.readAt ? <Text style={styles.markRead}>{t('notifications.markRead')}</Text> : null}
                  </View>
                </TouchableOpacity>
                {(item.attachmentPath || item.linkUrl) ? (
                  <View style={styles.actionsRow}>
                    {item.attachmentPath ? (
                      <TouchableOpacity style={styles.actionButton} onPress={() => void openAttachment(item)} disabled={busyId === item.id}>
                        <MaterialIcons name={item.attachmentMimeType === 'application/pdf' ? 'picture-as-pdf' : 'image'} size={17} color={colors.primary} />
                        <Text style={styles.actionText}>{attachmentLabel} · {formatAttachmentSize(item.attachmentSizeBytes)}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {item.linkUrl ? (
                      <TouchableOpacity style={styles.actionButton} onPress={() => void openLink(item)}>
                        <MaterialIcons name="open-in-new" size={17} color={colors.primary} />
                        <Text style={styles.actionText}>{t('notifications.openLink')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                <TouchableOpacity style={styles.deleteButton} onPress={() => remove(item)} disabled={busyId === item.id} accessibilityLabel={t('notifications.deleteAction')}>
                  {busyId === item.id ? <ActivityIndicator size="small" color={colors.danger} /> : <MaterialIcons name="delete-outline" size={20} color={colors.danger} />}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  refreshButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyText: { color: colors.textSecondary, fontSize: FontSize.base, marginTop: Spacing.sm },
  notificationCard: { position: 'relative', padding: Spacing.md, paddingRight: Spacing.xl + Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unreadCard: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  cardMain: { flexDirection: 'row', gap: Spacing.sm },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceVariant },
  itemBody: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemTitle: { flex: 1, color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  itemMessage: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginTop: 4 },
  itemDate: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 8 },
  markRead: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, marginTop: 5 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm, paddingLeft: 44 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.primary + '55', paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  actionText: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  deleteButton: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
