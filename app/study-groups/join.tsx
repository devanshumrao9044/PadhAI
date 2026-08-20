import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  getStudyGroupByInvite,
  joinStudyGroup,
  STUDY_GROUP_ICON_OPTIONS,
  submitStudyGroupReport,
  updateStudyGroupIcon,
  type StudyGroup,
  type StudyGroupIconKey,
  type StudyGroupReportReason,
} from '@/features/study-groups/services/studyGroups';
import StudyGroupReportSheet from '@/components/study-groups/StudyGroupReportSheet';

function iconName(iconKey: string): string {
  return STUDY_GROUP_ICON_OPTIONS.find(option => option.key === iconKey)?.icon ?? 'menu-book';
}

export default function JoinStudyGroupScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useApp();
  const { token: routeToken } = useLocalSearchParams<{ token?: string }>();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [token, setToken] = useState(typeof routeToken === 'string' ? routeToken : '');
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [iconKey, setIconKey] = useState<StudyGroupIconKey>('books');
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const submitGroupReport = async (reasonCode: StudyGroupReportReason, details: string) => {
    if (!group) return;
    await submitStudyGroupReport({ groupId: group.id, inviteToken: token, reasonCode, details });
    setMessage(t('groups.reportSubmitted'));
  };

  const preview = async () => {
    if (!token.trim()) {
      setError('Please enter an invite token or open a valid invite link.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await getStudyGroupByInvite(token);
      if (!result) throw new Error('This invite link is invalid or expired.');
      setGroup(result);
    } catch (previewError) {
      setGroup(null);
      setError(previewError instanceof Error ? previewError.message : 'Could not load this invite.');
    } finally {
      setLoading(false);
    }
  };

  const join = async () => {
    if (!group || !user?.id) return;
    setJoining(true);
    setError('');
    try {
      const status = await joinStudyGroup(group.id, token);
      if (status === 'pending') {
        setMessage(t('groups.pendingApproval'));
      } else {
        await updateStudyGroupIcon(group.id, iconKey);
        setMessage(t('groups.joined'));
      }
      setTimeout(() => router.replace(`/study-groups/${group.id}` as never), 800);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Could not join this group.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel={t('common.back')}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('groups.joinByLink')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('groups.inviteLink')}</Text>
        <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} placeholder="Paste invite token" placeholderTextColor={colors.textTertiary} style={styles.input} />
        <Pressable onPress={preview} disabled={loading} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>{loading ? t('common.loading') : t('groups.joinGroup')}</Text>
        </Pressable>
        {group ? (
          <View style={styles.previewCard}>
            <View style={styles.groupHeader}>
              <View style={styles.groupIcon}><MaterialIcons name={iconName(group.iconKey) as any} size={28} color={colors.primary} /></View>
              <View style={styles.groupCopy}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>{group.targetExam} · {group.maxMembers} {t('groups.members')}</Text>
              </View>
              <Pressable onPress={() => setReportOpen(true)} style={styles.moreButton} accessibilityLabel={t('groups.moreOptions')}>
                <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            {group.description ? <Text style={styles.body}>{group.description}</Text> : null}
            <Text style={styles.sectionTitle}>{t('groups.rules')}</Text>
            <Text style={styles.body}>{group.rules || t('groups.noRules')}</Text>
            <Text style={styles.sectionTitle}>{t('groups.chooseIcon')}</Text>
            <Text style={styles.hint}>{t('groups.iconHint')}</Text>
            <View style={styles.iconGrid}>
              {STUDY_GROUP_ICON_OPTIONS.map(option => {
                const selected = option.key === iconKey;
                return <Pressable key={option.key} onPress={() => setIconKey(option.key)} style={[styles.iconChoice, selected && styles.iconChoiceSelected]}><MaterialIcons name={option.icon as any} size={24} color={selected ? colors.primary : colors.textSecondary} /></Pressable>;
              })}
            </View>
            <Pressable onPress={join} disabled={joining} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, joining && styles.disabled]}>
              <Text style={styles.primaryText}>{joining ? t('common.loading') : t('groups.requestToJoin')}</Text>
            </Pressable>
          </View>
        ) : null}
        {message ? <View style={styles.successBox}><MaterialIcons name="check-circle" size={25} color={colors.success} /><Text style={styles.successText}>{message}</Text></View> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <StudyGroupReportSheet visible={reportOpen} groupName={group?.name ?? ''} onClose={() => setReportOpen(false)} onSubmitted={submitGroupReport} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  label: { color: colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold, marginTop: Spacing.sm },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
  secondaryButton: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm },
  secondaryText: { color: colors.primary, fontWeight: FontWeight.bold },
  previewCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, gap: Spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  groupIcon: { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  groupCopy: { flex: 1, minWidth: 0 },
  moreButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  groupName: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  groupMeta: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: Spacing.sm },
  body: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 22 },
  hint: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconChoice: { width: 46, height: 46, borderRadius: Radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '16' },
  primaryButton: { minHeight: 50, borderRadius: Radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  primaryText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success + '55', marginTop: Spacing.md },
  successText: { color: colors.textPrimary, flex: 1, lineHeight: 20 },
  error: { color: colors.danger, lineHeight: 20, marginTop: Spacing.sm },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
