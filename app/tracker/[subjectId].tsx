import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import ChapterItem from '@/components/feature/ChapterItem';
import type { Chapter } from '@/types/models';

const STATUS_OPTIONS: { value: Chapter['status']; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: Colors.textTertiary },
  { value: 'in_progress', label: 'In Progress', color: Colors.accent },
  { value: 'done', label: 'Done', color: Colors.success },
  { value: 'weak', label: 'Weak', color: Colors.warning },
];

export default function SubjectDetailScreen() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { subjects, getChaptersForSubject, addChapter, updateChapter, deleteChapter } = useApp();

  const subject = subjects.find(s => s.id === subjectId);
  const chapters = getChaptersForSubject(subjectId ?? '');

  const [addModal, setAddModal] = useState(false);
  const [chapterName, setChapterName] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<Chapter['status'] | 'all'>('all');
  const [saving, setSaving] = useState(false);

  const filtered = filterStatus === 'all'
    ? chapters
    : chapters.filter(c => c.status === filterStatus);

  const donePct = chapters.length > 0
    ? Math.round((chapters.filter(c => c.status === 'done').length / chapters.length) * 100)
    : 0;

  const handleAdd = async () => {
    if (!chapterName.trim() || !subjectId) return;
    setSaving(true);
    await addChapter(subjectId, chapterName.trim(), plannedDate || undefined);
    setSaving(false);
    setChapterName('');
    setPlannedDate('');
    setAddModal(false);
  };

  const handleStatusChange = async (id: string, status: Chapter['status']) => {
    const completedDate = status === 'done' ? new Date().toISOString().split('T')[0] : undefined;
    await updateChapter(id, { status, ...(completedDate ? { completedDate } : {}) });
  };

  if (!subject) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Subject not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.subjectDot, { backgroundColor: subject.colorHex }]} />
          <Text style={styles.subjectName}>{subject.name}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
          <MaterialIcons name="add" size={20} color={Colors.background} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{chapters.length} chapters • {donePct}% done</Text>
          <Text style={styles.progressPct}>{chapters.filter(c => c.status === 'done').length}/{chapters.length}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${donePct}%` as any, backgroundColor: subject.colorHex }]} />
        </View>
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filterStatus === 'all' ? styles.filterChipActive : null]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterText, filterStatus === 'all' ? styles.filterTextActive : null]}>All ({chapters.length})</Text>
          </Pressable>
          {STATUS_OPTIONS.map(o => {
            const count = chapters.filter(c => c.status === o.value).length;
            return (
              <Pressable
                key={o.value}
                style={[styles.filterChip, filterStatus === o.value ? styles.filterChipActive : null,
                  filterStatus === o.value ? { borderColor: o.color, backgroundColor: o.color + '22' } : null]}
                onPress={() => setFilterStatus(o.value)}
              >
                <Text style={[styles.filterText, filterStatus === o.value ? { color: o.color } : null]}>
                  {o.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Chapter list */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="library-books" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Koi chapter nahi</Text>
          <Text style={styles.emptyText}>Pehla chapter add karo</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {filtered.map(chapter => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              onStatusChange={(status) => handleStatusChange(chapter.id, status)}
              onPress={() => router.push(`/tracker/chapters/${chapter.id}` as any)}
              onDelete={() => deleteChapter(chapter.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Add Chapter Modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Naya Chapter</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Chapter ka naam (e.g. Kinematics)"
              placeholderTextColor={Colors.textTertiary}
              value={chapterName}
              onChangeText={setChapterName}
              autoFocus
              maxLength={60}
            />
            <TextInput
              style={styles.input}
              placeholder="Planned date (YYYY-MM-DD, optional)"
              placeholderTextColor={Colors.textTertiary}
              value={plannedDate}
              onChangeText={setPlannedDate}
              maxLength={10}
            />
            <TouchableOpacity
              style={[styles.saveBtn, (!chapterName.trim() || saving) ? styles.saveBtnDisabled : null]}
              onPress={handleAdd}
              disabled={!chapterName.trim() || saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Chapter Add Karo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md },
  backText: { fontSize: FontSize.base, color: Colors.textPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectDot: { width: 12, height: 12, borderRadius: 6 },
  subjectName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, includeFontPadding: false },
  addBtn: {
    backgroundColor: Colors.primary, width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  progressSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  progressPct: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semiBold },
  progressTrack: { height: 4, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  filterScroll: { marginBottom: 4 },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  filterText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  filterTextActive: { color: Colors.primary },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
