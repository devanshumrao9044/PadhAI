import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { calculateSessionXP } from '@/constants/levels';

const DURATIONS = [15, 25, 45, 60, 90];

export default function FocusScreen() {
  const router = useRouter();
  const { subjects, startSession } = useApp();
  const [selectedMins, setSelectedMins] = useState(25);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const activeSubjects = subjects.filter(s => !s.isDeleted);
  const expectedXP = calculateSessionXP(selectedMins);

  const handleLockIn = async () => {
    setStarting(true);
    await startSession(selectedMins, selectedSubjectId, null);
    setStarting(false);
    router.push('/focus/active');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>Focus Session</Text>
        <Text style={styles.subtitle}>Kitne der padna hai?</Text>

        {/* Duration selector */}
        <Text style={styles.sectionLabel}>DURATION CHUNO</Text>
        <View style={styles.durationGrid}>
          {DURATIONS.map(d => (
            <Pressable
              key={d}
              style={[styles.durationChip, selectedMins === d ? styles.durationChipActive : null]}
              onPress={() => setSelectedMins(d)}
            >
              <Text style={[styles.durationMins, selectedMins === d ? styles.durationMinsActive : null]}>
                {d}
              </Text>
              <Text style={[styles.durationLabel, selectedMins === d ? styles.durationLabelActive : null]}>
                min
              </Text>
            </Pressable>
          ))}
        </View>

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
          style={[styles.lockInBtn, starting ? styles.lockInBtnDisabled : null]}
          onPress={handleLockIn}
          disabled={starting}
          activeOpacity={0.85}
        >
          <MaterialIcons name="lock" size={24} color={Colors.background} />
          <Text style={styles.lockInText}>{starting ? 'Starting...' : 'LOCK IN'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xl },
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
