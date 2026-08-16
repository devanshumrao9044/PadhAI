import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import type { Chapter } from '@/types/models';

const STATUS_LABELS: Record<Chapter['status'], string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
  weak: 'Weak',
};

const STATUS_CYCLE: Chapter['status'][] = ['not_started', 'in_progress', 'done', 'weak'];

export default function ChapterDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(() => ({
    not_started: colors.textTertiary,
    in_progress: colors.accent,
    done: colors.success,
    weak: colors.warning,
  }), [colors]);
  const router = useRouter();
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const { chapters, subjects, getTopicsForChapter, addTopic, toggleTopic, deleteTopic, updateChapter } = useApp();

  const chapter = chapters.find(c => c.id === chapterId);
  const subject = chapter ? subjects.find(s => s.id === chapter.subjectId) : null;
  const topics = getTopicsForChapter(chapterId ?? '');

  const [topicName, setTopicName] = useState('');
  const [saving, setSaving] = useState(false);

  const doneCount = topics.filter(t => t.isDone).length;
  const pct = topics.length > 0 ? Math.round((doneCount / topics.length) * 100) : 0;

  const cycleStatus = async () => {
    if (!chapter) return;
    const idx = STATUS_CYCLE.indexOf(chapter.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const completedDate = next === 'done' ? new Date().toISOString().split('T')[0] : undefined;
    try {
      await updateChapter(chapter.id, { status: next, ...(completedDate ? { completedDate } : {}) });
    } catch {
      Alert.alert('Could Not Update Chapter', 'Please check your connection and try again.');
    }
  };

  const handleAddTopic = async () => {
    if (!topicName.trim() || !chapterId || saving) return;
    setSaving(true);
    try {
      await addTopic(chapterId, topicName.trim());
      setTopicName('');
    } catch {
      Alert.alert('Could Not Add Topic', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!chapter) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chapter not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = statusColors[chapter.status];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {subject ? (
            <View style={[styles.subjectBadge, { backgroundColor: subject.colorHex + '22', borderColor: subject.colorHex + '44' }]}>
              <Text style={[styles.subjectBadgeText, { color: subject.colorHex }]}>{subject.name}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Chapter title */}
      <View style={styles.chapterSection}>
        <Text style={styles.chapterName}>{chapter.name}</Text>
        <View style={styles.chapterMeta}>
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}
            onPress={cycleStatus}
            activeOpacity={0.7}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[chapter.status]}</Text>
            <MaterialIcons name="swap-horiz" size={14} color={statusColor} />
          </TouchableOpacity>
          {chapter.plannedDate ? (
            <View style={styles.dateBadge}>
              <MaterialIcons name="event" size={12} color={colors.textTertiary} />
              <Text style={styles.dateText}>{chapter.plannedDate}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Topic progress */}
      {topics.length > 0 ? (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{doneCount}/{topics.length} topics complete</Text>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        </View>
      ) : null}

      {/* Add topic bar */}
      <View style={styles.addTopicBar}>
        <TextInput
          style={styles.topicInput}
          placeholder="Topic add karo..."
          placeholderTextColor={colors.textTertiary}
          value={topicName}
          onChangeText={setTopicName}
          onSubmitEditing={handleAddTopic}
          returnKeyType="done"
          maxLength={80}
        />
        <TouchableOpacity
          style={[styles.addTopicBtn, !topicName.trim() ? styles.addTopicBtnDisabled : null]}
          onPress={handleAddTopic}
          disabled={!topicName.trim() || saving}
        >
          <MaterialIcons name="add" size={22} color={colors.background} />
        </TouchableOpacity>
      </View>

      {/* Topics list */}
      {topics.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="checklist" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Koi topic nahi</Text>
          <Text style={styles.emptyText}>Topics add karo — checklist banao</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {topics.map(t => (
            <View key={t.id} style={styles.topicRow}>
              <TouchableOpacity
                style={[styles.checkbox, t.isDone ? styles.checkboxDone : null]}
                onPress={() => toggleTopic(t.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {t.isDone ? <MaterialIcons name="check" size={14} color={colors.background} /> : null}
              </TouchableOpacity>
              <Text style={[styles.topicName, t.isDone ? styles.topicNameDone : null]}>
                {t.name}
              </Text>
              <TouchableOpacity onPress={() => deleteTopic(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="delete-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md },
  backText: { fontSize: FontSize.base, color: colors.textPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 12,
  },
  headerInfo: { flex: 1 },
  subjectBadge: {
    alignSelf: 'flex-start', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  subjectBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  chapterSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  chapterName: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    color: colors.textPrimary, marginBottom: Spacing.sm, includeFontPadding: false,
  },
  chapterMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: FontSize.xs, color: colors.textTertiary },
  progressSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: FontSize.sm, color: colors.textSecondary },
  progressPct: { fontSize: FontSize.sm, color: colors.primary, fontWeight: FontWeight.semiBold },
  progressTrack: { height: 4, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: Radius.full },
  addTopicBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  topicInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    color: colors.textPrimary, fontSize: FontSize.base,
  },
  addTopicBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  addTopicBtnDisabled: { opacity: 0.4 },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xl },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  topicName: { flex: 1, fontSize: FontSize.base, color: colors.textPrimary },
  topicNameDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary },
  emptyText: { fontSize: FontSize.base, color: colors.textSecondary, textAlign: 'center' },
});
