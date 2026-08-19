import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  isNotificationAdmin,
  loadAdminRecipients,
  sendAdminNotification,
  type AdminNotificationTarget,
  type NotificationRecipient,
} from '@/services/adminNotifications';

export default function AdminNotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useApp();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'owner' | 'admin' | null>(null);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [targetType, setTargetType] = useState<AdminNotificationTarget>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void isNotificationAdmin(user.id).then(async access => {
      if (!active) return;
      if (!access.allowed) {
        setLoading(false);
        return;
      }
      setRole(access.role);
      try {
        setRecipients(await loadAdminRecipients());
      } finally {
        if (active) setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  const selectedUser = recipients.find(item => item.id === selectedUserId) ?? null;

  const submit = () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const validTarget = targetType === 'all' || (targetType === 'level' && selectedLevel >= 1) || (targetType === 'user' && selectedUserId);
    if (!cleanTitle || !cleanBody || !validTarget) {
      Alert.alert(t('notifications.adminTitle'), t('notifications.invalidForm'));
      return;
    }
    Alert.alert(
      t('notifications.sendConfirmationTitle'),
      t('notifications.sendConfirmationMessage'),
      [
        { text: t('notifications.cancel'), style: 'cancel' },
        { text: t('notifications.send'), style: 'default', onPress: () => { void send(); } },
      ],
    );
  };

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const response = await sendAdminNotification({
        title: title.trim(),
        body: body.trim(),
        targetType,
        targetUserId: targetType === 'user' ? selectedUserId ?? undefined : undefined,
        targetLevel: targetType === 'level' ? selectedLevel : undefined,
      });
      setResult(t('notifications.sentSummary', {
        recipients: response.recipientCount,
        devices: response.deviceCount,
        delivered: response.sent,
      }));
      setTitle('');
      setBody('');
    } catch (error: any) {
      Alert.alert(t('notifications.adminTitle'), error?.message ?? t('notifications.noRecipients'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>{t('notifications.adminLoading')}</Text></View></SafeAreaView>;
  }

  if (!role) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <MaterialIcons name="lock" size={42} color={colors.danger} />
          <Text style={styles.deniedText}>{t('notifications.adminAccessDenied')}</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}><Text style={styles.backButtonText}>{t('notifications.cancel')}</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('notifications.adminTitle')}</Text>
          <Text style={styles.subtitle}>{role.toUpperCase()} · {t('notifications.adminDescription')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('notifications.recipient')}</Text>
          <View style={styles.targetRow}>
            {(['all', 'level', 'user'] as AdminNotificationTarget[]).map(option => {
              const active = targetType === option;
              const label = option === 'all' ? t('notifications.allUsers') : option === 'level' ? t('notifications.levelUsers') : t('notifications.oneUser');
              return (
                <TouchableOpacity key={option} style={[styles.targetChip, active && styles.targetChipActive]} onPress={() => setTargetType(option)}>
                  <Text style={[styles.targetText, active && styles.targetTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {targetType === 'level' ? (
            <View style={styles.optionBlock}>
              <Text style={styles.label}>{t('notifications.chooseLevel')}</Text>
              <View style={styles.levelGrid}>
                {Array.from({ length: 10 }, (_, index) => index + 1).map(level => (
                  <TouchableOpacity key={level} style={[styles.levelChip, selectedLevel === level && styles.levelChipActive]} onPress={() => setSelectedLevel(level)}>
                    <Text style={[styles.levelText, selectedLevel === level && styles.levelTextActive]}>{t('notifications.level')} {level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {targetType === 'user' ? (
            <View style={styles.optionBlock}>
              <Text style={styles.label}>{t('notifications.chooseUser')}</Text>
              <View style={styles.recipientList}>
                {recipients.map(recipient => (
                  <TouchableOpacity key={recipient.id} style={[styles.recipientRow, selectedUserId === recipient.id && styles.recipientRowActive]} onPress={() => setSelectedUserId(recipient.id)}>
                    <View style={styles.recipientAvatar}><Text style={styles.recipientAvatarText}>{(recipient.name ?? recipient.email ?? '?').charAt(0).toUpperCase()}</Text></View>
                    <View style={styles.recipientInfo}>
                      <Text style={styles.recipientName}>{recipient.name ?? 'Student'}{recipient.id === user?.id ? ` (${t('leaderboard.you')})` : ''}</Text>
                      <Text style={styles.recipientMeta}>{recipient.email ?? recipient.id} · {t('notifications.level')} {recipient.level ?? '-'}</Text>
                    </View>
                    {selectedUserId === recipient.id ? <MaterialIcons name="check-circle" size={21} color={colors.primary} /> : null}
                  </TouchableOpacity>
                ))}
              </View>
              {selectedUser ? <Text style={styles.selectionText}>{selectedUser.name ?? selectedUser.email}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('notifications.titleLabel')}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder={t('notifications.titlePlaceholder')} placeholderTextColor={colors.textTertiary} style={styles.input} maxLength={100} />
          <Text style={styles.sectionTitle}>{t('notifications.bodyLabel')}</Text>
          <TextInput value={body} onChangeText={setBody} placeholder={t('notifications.bodyPlaceholder')} placeholderTextColor={colors.textTertiary} style={[styles.input, styles.bodyInput]} multiline maxLength={500} />
          <Text style={styles.counter}>{title.length}/100 · {body.length}/500</Text>
          <TouchableOpacity style={[styles.sendButton, sending && styles.sendButtonDisabled]} onPress={submit} disabled={sending}>
            {sending ? <ActivityIndicator color={colors.background} /> : <MaterialIcons name="send" size={20} color={colors.background} />}
            <Text style={styles.sendButtonText}>{sending ? t('notifications.sending') : t('notifications.send')}</Text>
          </TouchableOpacity>
          {result ? <View style={styles.resultBox}><MaterialIcons name="check-circle" size={20} color={colors.success} /><Text style={styles.resultText}>{result}</Text></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { color: colors.textSecondary, marginTop: Spacing.sm },
  deniedText: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semiBold, marginTop: Spacing.md, textAlign: 'center' },
  backButtonLarge: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.md },
  backButtonText: { color: colors.background, fontWeight: FontWeight.bold },
  card: { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, gap: Spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  targetChip: { borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  targetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  targetText: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  targetTextActive: { color: colors.background },
  optionBlock: { gap: Spacing.xs, marginTop: Spacing.xs },
  label: { color: colors.textSecondary, fontSize: FontSize.sm },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  levelChip: { borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  levelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelText: { color: colors.textSecondary, fontSize: FontSize.xs },
  levelTextActive: { color: colors.background, fontWeight: FontWeight.bold },
  recipientList: { gap: Spacing.xs },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.sm },
  recipientRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  recipientAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '22' },
  recipientAvatarText: { color: colors.primary, fontWeight: FontWeight.bold },
  recipientInfo: { flex: 1 },
  recipientName: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  recipientMeta: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  selectionText: { color: colors.primary, fontSize: FontSize.xs },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: Radius.md, color: colors.textPrimary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: FontSize.base },
  bodyInput: { minHeight: 100, textAlignVertical: 'top' },
  counter: { color: colors.textTertiary, fontSize: FontSize.xs, textAlign: 'right' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: colors.background, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  resultBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, backgroundColor: colors.success + '18', borderRadius: Radius.md, padding: Spacing.sm },
  resultText: { flex: 1, color: colors.success, fontSize: FontSize.sm, lineHeight: 19 },
});
