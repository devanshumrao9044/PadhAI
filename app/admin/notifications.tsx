import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDocumentAsync } from 'expo-document-picker/src';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  deleteNotificationAttachment,
  isNotificationAdmin,
  loadAdminRecipients,
  sendAdminNotification,
  uploadNotificationAttachment,
  type AdminNotificationTarget,
  type NotificationRecipient,
} from '@/features/notifications/services/adminNotifications';
import {
  prepareNotificationImage,
  prepareNotificationPdf,
  type PreparedNotificationAttachment,
} from '@/features/notifications/services/notificationAttachments';

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
  const [linkUrl, setLinkUrl] = useState('');
  const [attachment, setAttachment] = useState<PreparedNotificationAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(t('notifications.adminTitle'), t('notifications.mediaPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setAttachmentBusy(true);
    try {
      setAttachment(await prepareNotificationImage(result.assets[0]));
    } catch (error: any) {
      Alert.alert(t('notifications.adminTitle'), error?.message ?? t('notifications.attachmentFailed'));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const pickPdf = async () => {
    const result = await getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setAttachmentBusy(true);
    try {
      setAttachment(await prepareNotificationPdf(result.assets[0]));
    } catch (error: any) {
      Alert.alert(t('notifications.adminTitle'), error?.message ?? t('notifications.attachmentFailed'));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const submit = () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanLink = linkUrl.trim();
    const validTarget = targetType === 'all' || (targetType === 'level' && selectedLevel >= 1) || (targetType === 'user' && selectedUserId);
    if (!cleanTitle || !cleanBody || !validTarget) {
      Alert.alert(t('notifications.adminTitle'), t('notifications.invalidForm'));
      return;
    }
    if (cleanLink) {
      try {
        const parsed = new URL(cleanLink);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('invalid');
      } catch {
        Alert.alert(t('notifications.adminTitle'), t('notifications.invalidLink'));
        return;
      }
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
    if (!user?.id) return;
    setSending(true);
    setResult(null);
    let uploadedPath: string | null = null;
    try {
      const uploaded = attachment ? await uploadNotificationAttachment(user.id, attachment) : undefined;
      uploadedPath = uploaded?.path ?? null;
      const response = await sendAdminNotification({
        title: title.trim(),
        body: body.trim(),
        targetType,
        targetUserId: targetType === 'user' ? selectedUserId ?? undefined : undefined,
        targetLevel: targetType === 'level' ? selectedLevel : undefined,
        attachment: uploaded,
        linkUrl: linkUrl.trim() || undefined,
      });
      setResult(t('notifications.sentSummary', {
        recipients: response.recipientCount,
        devices: response.deviceCount,
        delivered: response.sent,
      }));
      setTitle('');
      setBody('');
      setLinkUrl('');
      setAttachment(null);
    } catch (error: any) {
      if (uploadedPath) {
        try { await deleteNotificationAttachment(uploadedPath); } catch { /* best-effort cleanup */ }
      }
      Alert.alert(t('notifications.adminTitle'), error?.message ?? t('notifications.sendFailed'));
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
        <View style={styles.ownerBadge}><MaterialIcons name="verified-user" size={14} color={colors.success} /><Text style={styles.ownerBadgeText}>{role.toUpperCase()}</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><MaterialIcons name="campaign" size={25} color={colors.primary} /></View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>{t('notifications.composerTitle')}</Text>
            <Text style={styles.heroText}>{t('notifications.composerDescription')}</Text>
          </View>
        </View>

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
          <Text style={styles.sectionTitle}>{t('notifications.messageSection')}</Text>
          <Text style={styles.label}>{t('notifications.titleLabel')}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder={t('notifications.titlePlaceholder')} placeholderTextColor={colors.textTertiary} style={styles.input} maxLength={100} />
          <Text style={styles.label}>{t('notifications.bodyLabel')}</Text>
          <TextInput value={body} onChangeText={setBody} placeholder={t('notifications.bodyPlaceholder')} placeholderTextColor={colors.textTertiary} style={[styles.input, styles.bodyInput]} multiline maxLength={500} />
          <Text style={styles.counter}>{title.length}/100 · {body.length}/500</Text>

          <Text style={styles.label}>{t('notifications.linkLabel')}</Text>
          <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder={t('notifications.linkPlaceholder')} placeholderTextColor={colors.textTertiary} style={styles.input} autoCapitalize="none" keyboardType="url" />

          <Text style={styles.label}>{t('notifications.attachmentLabel')}</Text>
          <View style={styles.attachmentButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void pickImage()} disabled={attachmentBusy || sending}>
              <MaterialIcons name="add-photo-alternate" size={18} color={colors.primary} /><Text style={styles.secondaryButtonText}>{t('notifications.addImage')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void pickPdf()} disabled={attachmentBusy || sending}>
              <MaterialIcons name="picture-as-pdf" size={18} color={colors.primary} /><Text style={styles.secondaryButtonText}>{t('notifications.addPdf')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>{t('notifications.attachmentHelper')}</Text>
          {attachment ? (
            <View style={styles.attachmentPreview}>
              <MaterialIcons name={attachment.mimeType === 'application/pdf' ? 'picture-as-pdf' : 'image'} size={22} color={colors.primary} />
              <View style={styles.attachmentInfo}><Text style={styles.attachmentName} numberOfLines={1}>{attachment.displayName}</Text><Text style={styles.attachmentMeta}>{Math.ceil(attachment.sizeBytes / 1024)} KB · {attachment.mimeType === 'application/pdf' ? 'PDF' : 'JPEG'}</Text></View>
              <TouchableOpacity onPress={() => setAttachment(null)}><MaterialIcons name="close" size={20} color={colors.danger} /></TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.sendButton, (sending || attachmentBusy) && styles.sendButtonDisabled]} onPress={submit} disabled={sending || attachmentBusy}>
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
  ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.sm, backgroundColor: colors.success + '16', paddingHorizontal: 7, paddingVertical: 5 },
  ownerBadgeText: { color: colors.success, fontSize: 10, fontWeight: FontWeight.bold },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { color: colors.textSecondary, marginTop: Spacing.sm },
  deniedText: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semiBold, marginTop: Spacing.md, textAlign: 'center' },
  backButtonLarge: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.md },
  backButtonText: { color: colors.background, fontWeight: FontWeight.bold },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.primary + '12', borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.primary + '35', padding: Spacing.md },
  heroIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  heroBody: { flex: 1 },
  heroTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  heroText: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 18, marginTop: 3 },
  card: { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, gap: Spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  targetChip: { borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  targetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  targetText: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  targetTextActive: { color: colors.background },
  optionBlock: { gap: Spacing.xs, marginTop: Spacing.xs },
  label: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.xs },
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
  messageSection: { marginTop: Spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: Radius.md, color: colors.textPrimary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: FontSize.base },
  bodyInput: { minHeight: 100, textAlignVertical: 'top' },
  counter: { color: colors.textTertiary, fontSize: FontSize.xs, textAlign: 'right' },
  helperText: { color: colors.textTertiary, fontSize: FontSize.xs, lineHeight: 17 },
  attachmentButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.primary + '55', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  secondaryButtonText: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  attachmentPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: Spacing.sm },
  attachmentInfo: { flex: 1 },
  attachmentName: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  attachmentMeta: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: colors.background, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  resultBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, backgroundColor: colors.success + '18', borderRadius: Radius.md, padding: Spacing.sm },
  resultText: { flex: 1, color: colors.success, fontSize: FontSize.sm, lineHeight: 19 },
});
