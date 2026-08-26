import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import type { StudyGroupReportReason } from '@/features/study-groups/services/studyGroups';
import { createSingleActionLock } from '@/features/core/services/singleAction';

const REPORT_REASONS: StudyGroupReportReason[] = [
  'spam',
  'abuse',
  'fake_study_time',
  'inappropriate_content',
  'harassment',
  'privacy',
  'scam_or_fraud',
  'unsafe_or_illegal_content',
  'other',
];

type Props = {
  visible: boolean;
  groupName: string;
  onClose: () => void;
  onSubmitted: (reasonCode: StudyGroupReportReason, details: string) => Promise<void>;
};

function reasonKey(reason: StudyGroupReportReason): string {
  if (reason === 'fake_study_time') return 'reasonFakeStudy';
  if (reason === 'inappropriate_content') return 'reasonInappropriate';
  if (reason === 'scam_or_fraud') return 'reasonScam';
  if (reason === 'unsafe_or_illegal_content') return 'reasonUnsafe';
  return `reason${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;
}

export default function StudyGroupReportSheet({ visible, groupName, onClose, onSubmitted }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reason, setReason] = useState<StudyGroupReportReason>('other');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitActionRef = useRef(createSingleActionLock());

  useEffect(() => {
    if (!visible) return;
    setReason('other');
    setDetails('');
    setError('');
  }, [visible]);

  const submit = async () => {
    if (!submitActionRef.current.acquire()) return;
    setSaving(true);
    setError('');
    try {
      await onSubmitted(reason, details);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the report.');
    } finally {
      setSaving(false);
      submitActionRef.current.release();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>{t('groups.reportTitle')}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{groupName}</Text>
              </View>
              <Pressable disabled={saving} onPress={onClose} style={[styles.closeButton, saving && styles.disabled]} accessibilityLabel={t('common.close')}>
                <MaterialIcons name="close" size={21} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.label}>{t('groups.reportReason')}</Text>
            {REPORT_REASONS.map(option => (
              <Pressable key={option} disabled={saving} onPress={() => setReason(option)} style={[styles.reasonRow, saving && styles.disabled]}>
                <MaterialIcons name={reason === option ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={reason === option ? colors.primary : colors.textTertiary} />
                <Text style={styles.reasonText}>{t(`groups.${reasonKey(option)}` as any)}</Text>
              </Pressable>
            ))}
            <TextInput editable={!saving} value={details} onChangeText={setDetails} placeholder={t('groups.reportDetails')} placeholderTextColor={colors.textTertiary} style={styles.detailsInput} maxLength={1000} multiline textAlignVertical="top" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable disabled={saving} onPress={onClose} style={[styles.cancelButton, saving && styles.disabled]}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable>
              <Pressable onPress={() => { void submit(); }} disabled={saving} style={[styles.submitButton, saving && styles.disabled]}><Text style={styles.submitText}>{saving ? t('common.loading') : t('groups.reportSubmit')}</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '92%' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, marginBottom: 5 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 7 },
  reasonText: { color: colors.textSecondary, flex: 1, lineHeight: 20 },
  detailsInput: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.background, color: colors.textPrimary, minHeight: 88, padding: Spacing.sm, marginTop: Spacing.sm },
  error: { color: colors.danger, lineHeight: 20, marginTop: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: FontWeight.semiBold },
  submitButton: { flex: 1, minHeight: 48, borderRadius: Radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: colors.background, fontWeight: FontWeight.bold },
  disabled: { opacity: 0.55 },
});
