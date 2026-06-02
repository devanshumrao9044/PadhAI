import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { calculateSessionXP } from '@/constants/levels';

const DURATIONS = [15, 25, 45, 60, 90];
const CUSTOM_KEY = -1;

export default function FocusScreen() {
  const router = useRouter();
  const { subjects, startSession } = useApp();
  const [selectedMins, setSelectedMins] = useState(25);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
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

  const activeSubjects = subjects.filter(s => !s.isDeleted);
  const expectedXP = calculateSessionXP(effectiveMins);
  const isCustomSelected = customMode;
  const isLockInDisabled = starting || effectiveMins < 1 || effectiveMins > 480;

  const handleLockIn = async () => {
    if (isLockInDisabled) return;
    setStarting(true);
    await startSession(effectiveMins, selectedSubjectId, null);
    setStarting(false);
    router.push('/focus/active');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>Focus Session</Text>
        <Text style={styles.subtitle}>Kitne der padna hai?</Text>

        {/* Duration selector */}
        <Text style={styles.sectionLabel}>DURATION CHUNO</Text>
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
                min
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
              color={isCustomSelected ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.durationLabel, isCustomSelected ? styles.durationLabelActive : null]}>
              custom
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
              placeholder="e.g. 50"
              placeholderTextColor={Colors.textTertiary}
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={styles.customInputLabel}>minutes</Text>
            {customInput.length > 0 && parseInt(customInput, 10) > 0 ? (
              <View style={styles.customXPPreview}>
                <MaterialIcons name="bolt" size={14} color={Colors.warning} />
                <Text style={styles.customXPText}>+{calculateSessionXP(parseInt(customInput, 10))} XP</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* XP preview */}
        <View style={styles.xpPreview}>
          <MaterialIcons name="bolt" size={18} color={Colors.warning} />
          <Text style={styles.xpPreviewText}>
            Is session mein milega: <Text style={styles.xpPreviewBold}>+{expectedXP} XP</Text>
          </Text>
        </View>

        {/* Subject selector */}
        {activeSubjects.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>SUBJECT (OPTIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
              <View style={styles.subjectRow}>
                <Pressable
                  style={[styles.subjectChip, selectedSubjectId === null ? styles.subjectChipActive : null]}
                  onPress={() => setSelectedSubjectId(null)}
                >
                  <Text style={[styles.subjectChipText, selectedSubjectId === null ? styles.subjectChipTextActive : null]}>
                    General
                  </Text>
                </Pressable>
                {activeSubjects.map(s => (
                  <Pressable
                    key={s.id}
                    style={[styles.subjectChip, selectedSubjectId === s.id ? styles.subjectChipActive : null,
                      selectedSubjectId === s.id ? { borderColor: s.colorHex, backgroundColor: s.colorHex + '22' } : null]}
                    onPress={() => setSelectedSubjectId(s.id)}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: s.colorHex }]} />
                    <Text style={[styles.subjectChipText, selectedSubjectId === s.id ? styles.subjectChipTextActive : null]}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Rules reminder */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Focus Rules</Text>
          <View style={styles.ruleRow}>
            <MaterialIcons name="lock" size={14} color={Colors.primary} />
            <Text style={styles.ruleText}>Session ke beech app band karna = streak reset</Text>
          </View>
          <View style={styles.ruleRow}>
            <MaterialIcons name="warning" size={14} color={Colors.warning} />
            <Text style={styles.ruleText}>Session todne par XP kata jayega</Text>
          </View>
          <View style={styles.ruleRow}>
            <MaterialIcons name="touch-app" size={14} color={Colors.textSecondary} />
            <Text style={styles.ruleText}>Emergency exit: screen par triple tap</Text>
          </View>
        </View>

        {/* Lock In button */}
        <TouchableOpacity
          style={[styles.lockInBtn, isLockInDisabled ? styles.lockInBtnDisabled : null]}
          onPress={handleLockIn}
          disabled={isLockInDisabled}
          activeOpacity={0.85}
        >
          <MaterialIcons name="lock" size={24} color={Colors.background} />
          <Text style={styles.lockInText}>
            {starting ? 'Starting...' : (isCustomSelected && effectiveMins > 0 ? `LOCK IN — ${effectiveMins} MIN` : 'LOCK IN')}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  title: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
    color: Colors.textPrimary, includeFontPadding: false,
  },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 1.2,
    marginBottom: Spacing.sm, textTransform: 'uppercase',
  },
  durationGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginBottom: Spacing.sm,
  },
  durationChip: {
    alignItems: 'center', justifyContent: 'center',
    width: 72, height: 72,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  durationChipActive: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  durationMins: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textSecondary, includeFontPadding: false },
  durationMinsActive: { color: Colors.primary },
  durationLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  durationLabelActive: { color: Colors.primary },
  xpPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  xpPreviewText: { fontSize: FontSize.base, color: Colors.textSecondary },
  xpPreviewBold: { color: Colors.warning, fontWeight: FontWeight.bold },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary + '88',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  customInput: {
    fontSize: 32,
    fontWeight: FontWeight.extraBold,
    color: Colors.primary,
    includeFontPadding: false,
    minWidth: 70,
    padding: 0,
  },
  customInputLabel: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  customXPPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto' as any,
    backgroundColor: Colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  customXPText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.warning,
  },
  subjectScroll: { marginBottom: Spacing.lg },
  subjectRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  subjectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  subjectChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  subjectChipTextActive: { color: Colors.textPrimary },
  rulesCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.lg, gap: 10,
  },
  rulesTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, marginBottom: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  lockInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 18, gap: 10,
  },
  lockInBtnDisabled: { opacity: 0.6 },
  lockInText: { color: Colors.background, fontSize: FontSize.lg, fontWeight: FontWeight.extraBold, letterSpacing: 2 },
});
