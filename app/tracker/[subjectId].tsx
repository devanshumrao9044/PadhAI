import React, { useMemo, useState } from 'react';
import {
  FlatList, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Pressable, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import ChapterItem from '@/components/feature/ChapterItem';
import type { Chapter } from '@/types/models';

export default function SubjectDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusOptions = useMemo(() => [
    { value: 'not_started' as const, label: 'Not Started', color: colors.textTertiary },
    { value: 'in_progress' as const, label: 'In Progress', color: colors.accent },
    { value: 'done' as const, label: 'Done', color: colors.success },
    { value: 'weak' as const, label: 'Weak', color: colors.warning },
  ], [colors]);
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const {
    subjects, getChaptersForSubject, addChapter, updateChapter,
    deleteChapter, bulkDeleteChapters, updateSubject, deleteSubject
  } = useApp();

  const subject = subjects.find(s => s.id === subjectId);
  const chapters = useMemo(
    () => getChaptersForSubject(subjectId ?? ''),
    [getChaptersForSubject, subjectId],
  );

  // -- Chapter Modal & Form States --
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterName, setChapterName] = useState('');
  const [plannedDateObj, setPlannedDateObj] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // -- Subject Edit Modal States --
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [updatingSubject, setUpdatingSubject] = useState(false);

  // -- Filter & Selection States --
  const [filterStatus, setFilterStatus] = useState<Chapter['status'] | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const chapterCounts = useMemo(() => {
    const counts = {
      not_started: 0,
      in_progress: 0,
      done: 0,
      weak: 0,
    } as Record<Chapter['status'], number>;
    chapters.forEach(chapter => { counts[chapter.status] += 1; });
    return counts;
  }, [chapters]);

  const filtered = useMemo(
    () => filterStatus === 'all' ? chapters : chapters.filter(c => c.status === filterStatus),
    [chapters, filterStatus],
  );

  const donePct = chapters.length > 0
    ? Math.round((chapterCounts.done / chapters.length) * 100)
    : 0;

  // ── Subject Handlers ────────────────────────────
  const openEditSubjectModal = () => {
    if (!subject) return;
    setEditSubjectName(subject.name);
    setSubjectModalVisible(true);
  };

  const handleSaveSubject = async () => {
    if (!editSubjectName.trim() || !subject) return;
    setUpdatingSubject(true);
    try {
      await updateSubject(subject.id, { name: editSubjectName.trim() });
      setSubjectModalVisible(false);
    } catch (error: any) {
      console.error("Subject Update Error", error);
      alert("Failed to update subject: " + error.message);
    } finally {
      setUpdatingSubject(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!subject) return;
    try {
      await deleteSubject(subject.id);
      router.back(); // Redirect back to tracker main screen
    } catch (error: any) {
      console.error("Subject Delete Error", error);
      alert("Failed to delete subject: " + error.message);
    }
  };

  // ── Chapter Form Handlers ───────────────────────
  const openAddModal = () => {
    setEditingChapter(null);
    setChapterName('');
    setPlannedDateObj(null);
    setModalVisible(true);
  };

  const openEditModal = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setChapterName(chapter.name);
    setPlannedDateObj(chapter.plannedDate ? new Date(chapter.plannedDate) : null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!chapterName.trim() || !subjectId) return;
    setSaving(true);

    try {
      const dateStr = plannedDateObj ? plannedDateObj.toISOString().split('T')[0] : null;

      if (editingChapter) {
        await updateChapter(editingChapter.id, { name: chapterName.trim(), plannedDate: dateStr });
      } else {
        await addChapter(subjectId, chapterName.trim(), dateStr);
      }
      setModalVisible(false);
    } catch (error: any) {
      console.error("Save Error", error);
      alert("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) setPlannedDateObj(selectedDate);
  };

  const handleStatusChange = async (id: string, status: Chapter['status']) => {
    try {
      const completedDate = status === 'done' ? new Date().toISOString().split('T')[0] : undefined;
      await updateChapter(id, { status, ...(completedDate ? { completedDate } : {}) });
    } catch (error: any) {
      console.error("Status Update Error", error);
    }
  };

  // ── Delete Handlers ─────────────────────────────
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await bulkDeleteChapters(selectedIds);
      setSelectedIds([]);
      setIsSelectionMode(false);
    } catch (error: any) {
      console.error("Bulk Delete Failed", error);
      alert("Delete Failed: " + error.message);
    }
  };

  const handleSingleDelete = async (id: string) => {
    try {
      await deleteChapter(id);
    } catch (error: any) {
      console.error("Delete Failed", error);
      alert("Delete Failed: " + error.message);
    }
  };

  if (!subject) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
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

      {/* Dynamic Header */}
      {isSelectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedIds([]); }} style={styles.iconBtn}>
            <MaterialIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedIds.length} Selected</Text>
          <TouchableOpacity
             onPress={handleBulkDelete}
             style={styles.iconBtn}
             disabled={selectedIds.length === 0}
          >
            <MaterialIcons name="delete" size={26} color={selectedIds.length > 0 ? '#ff4444' : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={[styles.subjectDot, { backgroundColor: subject.colorHex }]} />
            <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>

            {/* 🚀 Subject Action Buttons */}
            <TouchableOpacity onPress={openEditSubjectModal} style={styles.subjectActionBtn} hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}>
              <MaterialIcons name="edit" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSubject} style={styles.subjectActionBtn} hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}>
              <MaterialIcons name="delete" size={16} color="#ff4444" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => setIsSelectionMode(true)}
            >
              <MaterialIcons name="checklist" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
              <MaterialIcons name="add" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{chapters.length} chapters • {donePct}% done</Text>
          <Text style={styles.progressPct}>{chapters.filter(c => c.status === 'done').length}/{chapters.length}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${donePct}%` as any, backgroundColor: subject.colorHex }]} />
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>All ({chapters.length})</Text>
          </Pressable>
          {statusOptions.map(o => {
            const count = chapterCounts[o.value];
            return (
              <Pressable
                key={o.value}
                style={[
                  styles.filterChip,
                  filterStatus === o.value && { borderColor: o.color, backgroundColor: o.color + '22' }
                ]}
                onPress={() => setFilterStatus(o.value)}
              >
                <Text style={[styles.filterText, filterStatus === o.value && { color: o.color }]}>
                  {o.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Chapter List */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="library-books" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No chapters yet</Text>
          <Text style={styles.emptyText}>Add your first chapter</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={chapter => chapter.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          renderItem={({ item: chapter }) => {
            const isSelected = selectedIds.includes(chapter.id);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => {
                  setIsSelectionMode(true);
                  if (!selectedIds.includes(chapter.id)) toggleSelection(chapter.id);
                }}
                onPress={() => isSelectionMode ? toggleSelection(chapter.id) : router.push(`/tracker/chapters/${chapter.id}` as any)}
                style={[
                  styles.chapterRowContainer,
                  isSelected && styles.chapterRowSelected,
                ]}
              >
                {isSelectionMode && (
                  <View style={styles.checkboxWrapper}>
                    <MaterialIcons
                      name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                      size={24}
                      color={isSelected ? colors.primary : colors.textTertiary}
                    />
                  </View>
                )}

                <View pointerEvents={isSelectionMode ? 'none' : 'auto'} style={{ flex: 1 }}>
                  <ChapterItem
                    chapter={chapter}
                    onStatusChange={(status) => handleStatusChange(chapter.id, status)}
                    onPress={() => isSelectionMode ? toggleSelection(chapter.id) : router.push(`/tracker/chapters/${chapter.id}` as any)}
                    onDelete={() => handleSingleDelete(chapter.id)}
                  />
                </View>

                {!isSelectionMode && (
                  <TouchableOpacity style={styles.editBtnIcon} onPress={() => openEditModal(chapter)}>
                    <MaterialIcons name="edit" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* 🚀 Edit Subject Modal */}
      <Modal visible={subjectModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Subject</Text>
              <TouchableOpacity onPress={() => setSubjectModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Subject Name"
              placeholderTextColor={colors.textTertiary}
              value={editSubjectName}
              onChangeText={setEditSubjectName}
              autoFocus
              maxLength={40}
            />

            <TouchableOpacity
              style={[styles.saveBtn, (!editSubjectName.trim() || updatingSubject) ? styles.saveBtnDisabled : null]}
              onPress={handleSaveSubject}
              disabled={!editSubjectName.trim() || updatingSubject}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{updatingSubject ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Chapter Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingChapter ? 'Edit Chapter' : 'New Chapter'}</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setShowPicker(false); }}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Chapter Name (e.g. Kinematics)"
              placeholderTextColor={colors.textTertiary}
              value={chapterName}
              onChangeText={setChapterName}
              autoFocus
              maxLength={60}
            />

            <TouchableOpacity style={styles.dateInput} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
              <View style={styles.dateInputContent}>
                <MaterialIcons name="calendar-today" size={20} color={plannedDateObj ? colors.primary : colors.textTertiary} />
                <Text style={[styles.dateText, !plannedDateObj && { color: colors.textTertiary }]}>
                  {plannedDateObj ? plannedDateObj.toISOString().split('T')[0] : 'Planned date (Optional)'}
                </Text>
              </View>
              {plannedDateObj && (
                <TouchableOpacity onPress={() => setPlannedDateObj(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name="close" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showPicker && (
              <View style={Platform.OS === 'ios' && styles.iosPickerContainer}>
                {Platform.OS === 'ios' && (
                  <View style={styles.iosPickerHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <Text style={styles.iosPickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DateTimePicker
                  value={plannedDateObj || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={onDateChange}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (!chapterName.trim() || saving) ? styles.saveBtnDisabled : null]}
              onPress={handleSave}
              disabled={!chapterName.trim() || saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : (editingChapter ? 'Save Changes' : 'Add Chapter')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  selectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: colors.primary + '11', borderBottomWidth: 1, borderBottomColor: colors.border
  },
  selectionCount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary },
  iconBtn: { padding: 4 },

  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 4 },
  subjectDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  subjectName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textPrimary, includeFontPadding: false, maxWidth: '60%' },
  subjectActionBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  addBtn: {
    backgroundColor: colors.primary, width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },

  progressSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: FontSize.sm, color: colors.textSecondary },
  progressPct: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.semiBold },
  progressTrack: { height: 4, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },

  filterScrollWrapper: { height: 50, marginBottom: Spacing.sm },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.md, alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  filterText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.medium },
  filterTextActive: { color: colors.primary },

  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xl, gap: Spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary },
  emptyText: { fontSize: FontSize.base, color: colors.textSecondary },

  chapterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    paddingRight: Spacing.sm,
  },
  chapterRowSelected: {
    backgroundColor: colors.primary + '11',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  checkboxWrapper: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center'
  },
  editBtnIcon: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary },
  input: {
    backgroundColor: colors.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    color: colors.textPrimary, fontSize: FontSize.md, marginBottom: Spacing.sm,
  },

  dateInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    marginBottom: Spacing.sm,
  },
  dateInputContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { fontSize: FontSize.md, color: colors.textPrimary },
  iosPickerContainer: {
    backgroundColor: colors.surface, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.sm,
  },
  iosPickerHeader: {
    alignItems: 'flex-end', padding: Spacing.sm, backgroundColor: colors.surfaceVariant,
    borderBottomWidth: 1, borderBottomColor: colors.border
  },
  iosPickerDone: { color: colors.primary, fontWeight: 'bold', fontSize: FontSize.md },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

