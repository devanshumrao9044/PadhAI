import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { loadUserNotifications, markUserNotificationRead, type UserNotification } from '@/services/adminNotifications';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      setItems(await loadUserNotifications());
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: UserNotification) => {
    if (item.readAt) return;
    await markUserNotificationRead(item.id);
    setItems(current => current.map(entry => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
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
          ) : items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.notificationCard, !item.readAt && styles.unreadCard]}
              onPress={() => void markRead(item)}
              activeOpacity={0.8}
            >
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
          ))}
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
  notificationCard: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unreadCard: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceVariant },
  itemBody: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemTitle: { flex: 1, color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  itemMessage: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginTop: 4 },
  itemDate: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 8 },
  markRead: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, marginTop: 5 },
});
