import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  createStudyGroup,
  STUDY_GROUP_ICON_OPTIONS,
  type StudyGroupIconKey,
  type StudyGroupVisibility,
} from '@/features/study-groups/services/studyGroups';
import { getSafeErrorMessage } from '@/features/core/services/safeError';
import { createSingleActionLock } from '@/features/core/services/singleAction';

export default function CreateStudyGroupScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [targetExam, setTargetExam] = useState(user?.targetExam ?? 'OTHER');
  const [dailyGoal, setDailyGoal] = useState(String(user?.dailyGoalMinutes ?? 120));
  const [maxMembers, setMaxMembers] = useState('12');
  const [visibility, setVisibility] = useState<StudyGroupVisibility>('private');
  const [iconKey, setIconKey] = useState<StudyGroupIconKey>('books');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const createActionRef = useRef(createSingleActionLock());

  const handleCreate = async () => {
    if (!createActionRef.current.acquire()) return;
    const trimmedName = name.trim();
    const goal = Number(dailyGoal);
    const limit = Number(maxMembers);
    if (trimmedName.length < 2) {
      setError('Group name must be at least 2 characters.');
      createActionRef.current.release();
      return;
    }
    if (!Number.isInteger(goal) || goal < 1 || goal > 1440) {
      setError('Daily goal must be between 1 and 1440 minutes.');
      createActionRef.current.release();
      return;
    }
    if (!Number.isInteger(limit) || limit < 2 || limit > 100) {
      setError('Member limit must be between 2 and 100.');
      createActionRef.current.release();
      return;
    }
    if (!user?.id) {
      createActionRef.current.release();
      return;
    }
    setError('');
    setSaving(true);
    try {
      const created = await createStudyGroup({
        name: trimmedName,
        description,
        rules,
        targetExam,
        dailyGoalMinutes: goal,
        maxMembers: limit,
        visibility,
        iconKey,
      });
      router.replace(`/study-groups/${created.id}` as never);
    } catch (createError) {
      setError(getSafeErrorMessage(createError, {
        fallback: 'Could not create the group. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to create a group.',
        rateLimit: 'Too many requests. Please wait and try again.',
      }));
    } finally {
      setSaving(false);
      createActionRef.current.release();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel={t('common.back')}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('groups.createGroup')}</Text>
          <Text style={styles.subtitle}>{t('groups.subtitle')}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('groups.chooseIcon')}</Text>
        <Text style={styles.hint}>{t('groups.iconHint')}</Text>
        <View style={styles.iconGrid}>
          {STUDY_GROUP_ICON_OPTIONS.map(option => {
            const selected = option.key === iconKey;
            return (
              <Pressable key={option.key} onPress={() => setIconKey(option.key)} style={[styles.iconChoice, selected && styles.iconChoiceSelected]}>
                <MaterialIcons name={option.icon as any} size={26} color={selected ? colors.primary : colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('groups.title')}</Text>
        <TextInput value={name} onChangeText={setName} placeholder="JEE PHODGE" placeholderTextColor={colors.textTertiary} style={styles.input} maxLength={60} />
        <TextInput value={description} onChangeText={setDescription} placeholder={t('groups.description')} placeholderTextColor={colors.textTertiary} style={[styles.input, styles.multiline]} maxLength={240} multiline />
        <TextInput value={rules} onChangeText={setRules} placeholder={t('groups.rules')} placeholderTextColor={colors.textTertiary} style={[styles.input, styles.rulesInput]} maxLength={2000} multiline />

        <Text style={styles.label}>{t('groups.targetExam')}</Text>
        <TextInput value={targetExam} onChangeText={value => setTargetExam(value as typeof targetExam)} placeholder="JEE / NEET / OTHER" placeholderTextColor={colors.textTertiary} style={styles.input} maxLength={40} autoCapitalize="characters" />
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.smallLabel}>{t('groups.dailyGoal')}</Text>
            <TextInput value={dailyGoal} onChangeText={setDailyGoal} keyboardType="number-pad" style={styles.input} placeholder="120" placeholderTextColor={colors.textTertiary} maxLength={4} />
          </View>
          <View style={styles.half}>
            <Text style={styles.smallLabel}>{t('groups.maxMembers')}</Text>
            <TextInput value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" style={styles.input} placeholder="12" placeholderTextColor={colors.textTertiary} maxLength={3} />
          </View>
        </View>

        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityRow}>
          {(['private', 'public'] as StudyGroupVisibility[]).map(option => (
            <Pressable key={option} onPress={() => setVisibility(option)} style={[styles.visibilityButton, visibility === option && styles.visibilityButtonSelected]}>
              <MaterialIcons name={option === 'private' ? 'lock' : 'public'} size={18} color={visibility === option ? colors.primary : colors.textSecondary} />
              <Text style={[styles.visibilityText, visibility === option && styles.visibilityTextSelected]}>
                {option === 'private' ? t('groups.privateGroup') : t('groups.publicGroup')}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={handleCreate} disabled={saving} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{saving ? t('common.loading') : t('groups.createGroup')}</Text>
        </Pressable>
        <Text style={styles.footerHint}>Private groups use an invite link and owner approval. Public groups are discoverable in search.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCopy: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  label: { color: colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold, marginTop: Spacing.sm },
  smallLabel: { color: colors.textSecondary, fontSize: FontSize.sm, marginBottom: 4 },
  hint: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  iconChoice: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  iconChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '16' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, color: colors.textPrimary, backgroundColor: colors.surface, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  rulesInput: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  visibilityRow: { flexDirection: 'row', gap: Spacing.sm },
  visibilityButton: { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  visibilityButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '16' },
  visibilityText: { color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  visibilityTextSelected: { color: colors.primary },
  error: { color: colors.danger, fontSize: FontSize.sm, lineHeight: 20, marginTop: Spacing.sm },
  primaryButton: { minHeight: 52, borderRadius: Radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  primaryButtonText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  footerHint: { color: colors.textTertiary, fontSize: FontSize.sm, lineHeight: 19, marginTop: Spacing.sm },
});
