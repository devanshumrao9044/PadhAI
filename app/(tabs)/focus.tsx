import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { calculateSessionXP } from '@/constants/levels';

const DURATIONS = [15, 25, 45, 60, 90];
const CUSTOM_KEY = -1;

export default function FocusScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { subjectId: routeSubjectId, chapterId: routeChapterId } = useLocalSearchParams<{ subjectId?: string; chapterId?: string }>();
  const { subjects, chapters, startSession } = useApp();
  const initialSubjectId = typeof routeSubjectId === 'string' ? routeSubjectId : null;
  const initialChapterId = typeof routeChapterId === 'string' ? routeChapterId : null;
  const [selectedMins, setSelectedMins] = useState(25);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapterId);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleDurationSelect = (d: number) => {
    if (d === CUSTOM_KEY) {
      setCustomMode(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setCustomMode(false);
      setSelectedMins(d);
      setCustomInput('');
    }
  };

  const handleCustomChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setCustomInput(cleaned);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num >= 1 && num <= 480) {
      setSelectedMins(num);
    }
  };

  const effectiveMins = customMode
    ? (parseInt(customInput, 10) || 0)
    : selectedMins;

  const activeSubjects = useMemo(() => subjects.filter(s => !s.isDeleted), [subjects]);
  const activeChapters = useMemo(
    () => chapters.filter(chapter => !chapter.isDeleted && chapter.subjectId === selectedSubjectId),
    [chapters, selectedSubjectId],
  );
  useEffect(() => {
    if (selectedChapterId && !activeChapters.some(chapter => chapter.id === selectedChapterId)) {
      setSelectedChapterId(null);
    }
  }, [activeChapters, selectedChapterId]);
  const expectedXP = calculateSessionXP(effectiveMins);
  const isCustomSelected = customMode;
  const isLockInDisabled = starting || effectiveMins < 1 || effectiveMins > 480;

  const handleLockIn = async () => {
    if (isLockInDisabled) return;
    setStarting(true);
    try {
      await startSession(effectiveMins, selectedSubjectId, selectedChapterId);
      router.push('/focus/active');
    } catch {
      Alert.alert(t('focus.startErrorTitle'), t('focus.startErrorMessage'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>{t('focus.screenTitle')}</Text>
        <Text style={styles.subtitle}>{t('focus.screenSubtitle')}</Text>

        {/* Duration selector */}
        <Text style={styles.sectionLabel}>{t('focus.durationChoose')}</Text>
        <View style={styles.durationGrid}>
          {DURATIONS.map(d => (
            <Pressable
              key={d}
              style={[styles.durationChip, !isCustomSelected && selectedMins === d ? styles.durationChipActive : null]}
              onPress={() => handleDurationSelect(d)}
            >
              <Text style={[styles.durationMins, !isCustomSelected && selectedMins === d ? styles.durationMinsActive : null]}>
                {d}
              </Text>
              <Text style={[styles.durationLabel, !isCustomSelected && selectedMins === d ? styles.durationLabelActive : null]}>
                {t('focus.durationMin')}
              </Text>
            </Pressable>
          ))}
          {/* Custom chip */}
          <Pressable
            style={[styles.durationChip, isCustomSelected ? styles.durationChipActive : null]}
            onPress={() => handleDurationSelect(CUSTOM_KEY)}
          >
            <MaterialIcons
              name="edit"
              size={22}
              color={isCustomSelected ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.durationLabel, isCustomSelected ? styles.durationLabelActive : null]}>
              {t('focus.custom')}
            </Text>
          </Pressable>
        </View>

        {/* Custom duration input — appears below grid when custom is active */}
        {isCustomSelected ? (
          <View style={styles.customInputRow}>
            <TextInput
              ref={inputRef}
              style={styles.customInput}
              value={customInput}
              onChangeText={handleCustomChange}
              keyboardType="number-pad"
              placeholder={t('focus.customPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={styles.customInputLabel}>{t('focus.minutes')}</Text>
            {customInput.length > 0 && parseInt(customInput, 10) > 0 ? (
              <View style={styles.customXPPreview}>
                <MaterialIcons name="bolt" size={14} color={colors.warning} />
                <Text style={styles.customXPText}>+{calculateSessionXP(parseInt(customInput, 10))} XP</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* XP preview */}
        <View style={styles.xpPreview}>
          <MaterialIcons name="bolt" size={18} color={colors.warning} />
          <Text style={styles.xpPreviewText} numberOfLines={2} ellipsizeMode="tail">
            {t('focus.sessionXP')} <Text style={styles.xpPreviewBold}>+{expectedXP} XP</Text>
          </Text>
        </View>

        {/* Subject selector */}
        {activeSubjects.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>{t('focus.subjectOptional')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
              <View style={styles.subjectRow}>
                <Pressable
                  style={[styles.subjectChip, selectedSubjectId === null ? styles.subjectChipActive : null]}
                    onPress={() => { setSelectedSubjectId(null); setSelectedChapterId(null); }}
                >
                  <Text style={[styles.subjectChipText, selectedSubjectId === null ? styles.subjectChipTextActive : null]}>
                    {t('focus.general')}
                  </Text>
                </Pressable>
                {activeSubjects.map(s => (
                  <Pressable
                    key={s.id}
                    style={[styles.subjectChip, selectedSubjectId === s.id ? styles.subjectChipActive : null,
                      selectedSubjectId === s.id ? { borderColor: s.colorHex, backgroundColor: s.colorHex + '22' } : null]}
                    onPress={() => { setSelectedSubjectId(s.id); setSelectedChapterId(null); }}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: s.colorHex }]} />
                      <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.subjectChipText, selectedSubjectId === s.id ? styles.subjectChipTextActive : null]}>
                        {s.name}
                      </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {selectedSubjectId && activeChapters.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>{t('focus.trackerChapterOptional')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
              <View style={styles.subjectRow}>
                <Pressable
                  style={[styles.subjectChip, selectedChapterId === null ? styles.subjectChipActive : null]}
                  onPress={() => setSelectedChapterId(null)}
                >
                  <Text style={[styles.subjectChipText, selectedChapterId === null ? styles.subjectChipTextActive : null]}>
                    {t('focus.general')}
                  </Text>
                </Pressable>
                {activeChapters.map(chapter => (
                  <Pressable
                    key={chapter.id}
                    style={[styles.subjectChip, selectedChapterId === chapter.id ? styles.subjectChipActive : null]}
                    onPress={() => setSelectedChapterId(chapter.id)}
                  >
                    <MaterialIcons name="menu-book" size={14} color={selectedChapterId === chapter.id ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.subjectChipText, selectedChapterId === chapter.id ? styles.subjectChipTextActive : null]} numberOfLines={2} ellipsizeMode="tail">
                        {chapter.name}
                      </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : selectedSubjectId ? (
          <Text style={styles.trackerHint}>{t('focus.noActiveChapters')}</Text>
        ) : (
          <Text style={styles.trackerHint}>{t('focus.selectTracker')}</Text>
        )}

        {/* Rules reminder */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>{t('focus.focusRules')}</Text>
          <View style={styles.ruleRow}>
            <MaterialIcons name="lock" size={14} color={colors.primary} />
            <Text style={styles.ruleText}>{t('focus.ruleBackground')}</Text>
          </View>
          <View style={styles.ruleRow}>
            <MaterialIcons name="warning" size={14} color={colors.warning} />
            <Text style={styles.ruleText}>{t('focus.ruleBroken')}</Text>
          </View>
          <View style={styles.ruleRow}>
            <MaterialIcons name="touch-app" size={14} color={colors.textSecondary} />
            <Text style={styles.ruleText}>{t('focus.ruleEmergency')}</Text>
          </View>
        </View>

        {/* Lock In button */}
        <TouchableOpacity
          style={[styles.lockInBtn, isLockInDisabled ? styles.lockInBtnDisabled : null]}
          onPress={handleLockIn}
          disabled={isLockInDisabled}
          activeOpacity={0.85}
        >
          <MaterialIcons name="lock" size={24} color={colors.background} />
          <Text style={styles.lockInText}>
            {starting ? t('focus.starting') : (isCustomSelected && effectiveMins > 0 ? t('focus.lockInMinutes', { value: effectiveMins }) : t('focus.lockIn'))}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
    color: colors.textPrimary, includeFontPadding: false,
  },
  subtitle: { fontSize: FontSize.base, color: colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: colors.textTertiary, letterSpacing: 1.2,
    marginBottom: Spacing.sm, textTransform: 'uppercase',
  },
  durationGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginBottom: Spacing.sm,
  },
  durationChip: {
    alignItems: 'center', justifyContent: 'center',
    width: 72, height: 72,
    backgroundColor: colors.surface, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
  },
  durationChipActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary,
  },
  durationMins: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textSecondary, includeFontPadding: false },
  durationMinsActive: { color: colors.primary },
  durationLabel: { fontSize: FontSize.xs, color: colors.textTertiary },
  durationLabelActive: { color: colors.primary },
  xpPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  xpPreviewText: { fontSize: FontSize.base, color: colors.textSecondary, flex: 1, flexShrink: 1, minWidth: 0, lineHeight: 20 },
  xpPreviewBold: { color: colors.warning, fontWeight: FontWeight.bold },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary + '88',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  customInput: {
    fontSize: 32,
    fontWeight: FontWeight.extraBold,
    color: colors.primary,
    includeFontPadding: false,
    minWidth: 70,
    padding: 0,
  },
  customInputLabel: {
    fontSize: FontSize.base,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  customXPPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto' as any,
    backgroundColor: colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  customXPText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.warning,
  },
  subjectScroll: { marginBottom: Spacing.lg },
  subjectRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  subjectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    maxWidth: 190, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  subjectChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectChipText: { maxWidth: 150, fontSize: FontSize.sm, lineHeight: 18, color: colors.textSecondary, fontWeight: FontWeight.medium, flexShrink: 1 },
  subjectChipTextActive: { color: colors.textPrimary },
  trackerHint: { fontSize: FontSize.sm, color: colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  rulesCard: {
    backgroundColor: colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, marginBottom: Spacing.lg, gap: 10,
  },
  rulesTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: colors.textPrimary, marginBottom: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleText: { fontSize: FontSize.sm, lineHeight: 19, color: colors.textSecondary, flex: 1, minWidth: 0, flexShrink: 1 },
  lockInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: Radius.md,
    paddingVertical: 18, gap: 10,
  },
  lockInBtnDisabled: { opacity: 0.6 },
  lockInText: { color: colors.background, fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.extraBold, letterSpacing: 0.5, textAlign: 'center', flexShrink: 1 },
});
