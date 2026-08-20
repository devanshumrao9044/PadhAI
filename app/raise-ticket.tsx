import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { submitStudyGroupTicket, type StudyGroupTicketCategory } from '@/features/study-groups/services/studyGroups';

const CATEGORIES: StudyGroupTicketCategory[] = ['bug', 'account', 'study_group', 'report_follow_up', 'feature_request', 'other'];

export default function RaiseTicketScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useApp();
  const { groupId: routeGroupId, reportId: routeReportId } = useLocalSearchParams<{ groupId?: string; reportId?: string }>();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [category, setCategory] = useState<StudyGroupTicketCategory>('bug');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!submitted) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
  }, [scale, submitted]);

  const submit = async () => {
    if (!user?.id) return;
    if (subject.trim().length < 3) { setError('Subject must be at least 3 characters.'); return; }
    if (details.trim().length < 5) { setError('Please add a little more detail.'); return; }
    setSaving(true);
    setError('');
    try {
      await submitStudyGroupTicket({ userId: user.id, category, subject, details, groupId: typeof routeGroupId === 'string' ? routeGroupId : null, reportId: typeof routeReportId === 'string' ? routeReportId : null });
      setSubmitted(true);
    } catch (ticketError) {
      setError(ticketError instanceof Error ? ticketError.message : 'Could not send the ticket.');
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><Animated.View style={[styles.successPanel, { transform: [{ scale }] }]}><View style={styles.successIcon}><MaterialIcons name="check" size={40} color={colors.success} /></View><Text style={styles.successTitle}>{t('support.ticketSubmitted')}</Text><Text style={styles.successBody}>{t('support.reviewStatusHint')}</Text><Pressable onPress={() => router.replace('/review-tickets' as never)} style={styles.primaryButton}><Text style={styles.primaryText}>{t('support.reviewTicketsReports')}</Text></Pressable><Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t('common.close')}</Text></Pressable></Animated.View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.headerButton}><MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} /></Pressable><Text style={styles.title}>{t('support.reportProblem')}</Text></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heroTitle}>{t('support.ticketTitle')}</Text>
        <Text style={styles.heroBody}>Use this for bugs, account issues, group concerns or feature suggestions. Do not share passwords.</Text>
        <Text style={styles.label}>{t('support.ticketCategory')}</Text>
        <View style={styles.chipGrid}>{CATEGORIES.map(item => { const selected = category === item; const key = item === 'study_group' ? 'categoryStudyGroup' : item === 'report_follow_up' ? 'categoryReportFollowUp' : item === 'feature_request' ? 'categoryFeature' : item === 'bug' ? 'categoryBug' : item === 'account' ? 'categoryAccount' : 'categoryOther'; return <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(`support.${key}` as any)}</Text></Pressable>; })}</View>
        <Text style={styles.label}>{t('support.ticketSubject')}</Text>
        <TextInput value={subject} onChangeText={setSubject} placeholder={t('support.ticketSubjectPlaceholder')} placeholderTextColor={colors.textTertiary} style={styles.input} maxLength={100} />
        <Text style={styles.label}>{t('support.ticketDetails')}</Text>
        <TextInput value={details} onChangeText={setDetails} placeholder={t('support.ticketDetailsPlaceholder')} placeholderTextColor={colors.textTertiary} style={[styles.input, styles.multiline]} maxLength={2000} multiline textAlignVertical="top" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => { void submit(); }} disabled={saving} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}><Text style={styles.primaryText}>{saving ? t('common.loading') : t('support.sendTicket')}</Text></Pressable>
        <Text style={styles.footerHint}>Your ticket is visible to you and the PadhAI owner for resolution.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  content: { padding: Spacing.md, paddingBottom: 50, gap: Spacing.sm },
  heroTitle: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: Spacing.sm },
  heroBody: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.sm },
  label: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, marginTop: Spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  chipText: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  chipTextSelected: { color: colors.primary },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md },
  multiline: { minHeight: 150 },
  error: { color: colors.danger, lineHeight: 20 },
  primaryButton: { minHeight: 50, borderRadius: Radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  primaryText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  secondaryButton: { minHeight: 50, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  secondaryText: { color: colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  footerHint: { color: colors.textTertiary, fontSize: FontSize.xs, lineHeight: 18, marginTop: Spacing.sm },
  successPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  successIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.success + '18', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  successTitle: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center', lineHeight: 29 },
  successBody: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 22, textAlign: 'center', marginBottom: Spacing.md },
});
