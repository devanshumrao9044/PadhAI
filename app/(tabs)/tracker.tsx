import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, FlatList, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { loadSubjectTimers, saveSubjectTimers } from '@/features/productivity/services/productivity';
import type { SubjectTimerState } from '@/types/models';

const COLOR_OPTIONS = ['#6B21A8', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
const ICON_OPTIONS = ['book', 'functions', 'biotech', 'shutter-speed', 'psychology', 'computer'];

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
  const remainder = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${remainder}`;
}

export default function TrackerScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user, subjects, addSubject } = useApp();

  const [timerStates, setTimerStates] = useState<Record<string, SubjectTimerState>>({});
  const [now, setNow] = useState(Date.now());
  const [modalVisible, setModalVisible] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    void loadSubjectTimers(user.id).then((saved) => {
      if (mounted) setTimerStates(saved);
    });
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    const running = Object.values(timerStates).some(timer => timer.startedAt !== null);
    if (!running) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timerStates]);

  const elapsedFor = (subjectId: string): number => {
    const state = timerStates[subjectId];
    if (!state) return 0;
    return state.elapsedSeconds + (state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0);
  };

  const persistTimers = (next: Record<string, SubjectTimerState>) => {
    setTimerStates(next);
    if (user?.id) void saveSubjectTimers(user.id, next);
  };

  const toggleSubjectTimer = (subjectId: string) => {
    const current = timerStates[subjectId] ?? { elapsedSeconds: 0, startedAt: null };
    const next: Record<string, SubjectTimerState> = { ...timerStates };
    Object.entries(next).forEach(([id, state]) => {
      if (state.startedAt !== null) {
        next[id] = { elapsedSeconds: elapsedFor(id), startedAt: null };
      }
    });
    next[subjectId] = current.startedAt !== null
      ? { elapsedSeconds: elapsedFor(subjectId), startedAt: null }
      : { elapsedSeconds: current.elapsedSeconds, startedAt: Date.now() };
    persistTimers(next);
  };

  // 🚀 Cleaned & Fixed handleCreateSubject
  const handleCreateSubject = async () => {
    if (!subjectName.trim()) return;

    setSaving(true);
    try {
      if (typeof addSubject === 'function') {
        await addSubject(subjectName.trim(), selectedColor, selectedIcon);
      }

      // ✅ Success hone par reset aur close
      setModalVisible(false);
      setSubjectName('');
      setSelectedColor(COLOR_OPTIONS[0]);
      setSelectedIcon(ICON_OPTIONS[0]);
    } catch (error: any) {
      console.error("Error creating subject:", error);
      Alert.alert(
        "Error",
        t('tracker.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📚 {t('tracker.title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => router.push('/todo' as any)}
              accessibilityLabel={t('tracker.openTodo')}
            >
              <MaterialIcons name="checklist" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => router.push('/calendar' as any)}
              accessibilityLabel={t('tracker.openCalendar')}
            >
              <MaterialIcons name="calendar-month" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
              <MaterialIcons name="add" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
        </View>

      {/* Subjects List */}
      {!subjects || subjects.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="library-books" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>{t('tracker.noSubjects')}</Text>
          <Text style={styles.emptyText}>{t('tracker.addFirstSubject')}</Text>
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.subjectCard}
              onPress={() => router.push(`/tracker/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardInfo}>
                <View style={[styles.subjectDot, { backgroundColor: item.colorHex || colors.primary }]}>
                  <MaterialIcons name={(item.iconName as any) || 'book'} size={14} color={colors.background} />
                </View>
                <View style={styles.subjectCopy}>
                  <Text style={styles.subjectName}>{item.name}</Text>
                  <Text style={styles.timerText}>{formatTimer(elapsedFor(item.id))}</Text>
                </View>
              </View>
              <View style={styles.subjectActions}>
                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: item.colorHex || colors.primary }]}
                  onPress={() => toggleSubjectTimer(item.id)}
                  accessibilityLabel={timerStates[item.id]?.startedAt ? t('tracker.pauseTimer') : t('tracker.startTimer')}
                >
                  <MaterialIcons
                    name={timerStates[item.id]?.startedAt ? 'pause' : 'play-arrow'}
                    size={19}
                    color={colors.background}
                  />
                </TouchableOpacity>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add Subject Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('tracker.newSubject')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder={t('tracker.subjectPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={subjectName}
              onChangeText={setSubjectName}
              autoFocus
              maxLength={40}
            />

            {/* Color Selection */}
            <Text style={styles.sectionLabel}>{t('tracker.selectColor')}</Text>
            <View style={styles.optionsRow}>
              {COLOR_OPTIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorCircle, { backgroundColor: c }, selectedColor === c && styles.circleSelected]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            {/* Icon Selection */}
            <Text style={styles.sectionLabel}>{t('tracker.selectIcon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconScrollRow}>
              {ICON_OPTIONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconBox,
                    selectedIcon === icon && { backgroundColor: selectedColor }
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <MaterialIcons
                    name={icon as any}
                    size={24}
                    color={selectedIcon === icon ? colors.background : colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: selectedColor }, (!subjectName.trim() || saving) ? styles.saveBtnDisabled : null]}
              onPress={handleCreateSubject}
              disabled={!subjectName.trim() || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveBtnText}>{t('tracker.addSubject')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerTitle: { flex: 1, minWidth: 0, fontSize: FontSize.xl, lineHeight: 28, fontWeight: FontWeight.bold, color: colors.textPrimary, flexShrink: 1 },
  headerActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addBtn: { backgroundColor: colors.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  subjectCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  subjectDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subjectCopy: { flex: 1, minWidth: 0 },
  subjectName: { fontSize: FontSize.base, lineHeight: 20, fontWeight: FontWeight.semiBold, color: colors.textPrimary, flexShrink: 1 },
  timerText: { fontSize: FontSize.xs, lineHeight: 17, color: colors.textSecondary, marginTop: 3, fontVariant: ['tabular-nums'] },
  subjectActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  playBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold, color: colors.textPrimary, textAlign: 'center', flexShrink: 1 },
  emptyText: { fontSize: FontSize.base, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', flexShrink: 1 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: Spacing.md },
  modalTitle: { flex: 1, minWidth: 0, fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold, color: colors.textPrimary, flexShrink: 1 },
  input: { backgroundColor: colors.surfaceVariant, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.md, paddingVertical: 14, color: colors.textPrimary, fontSize: FontSize.md, marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, lineHeight: 19, color: colors.textSecondary, marginBottom: Spacing.sm, fontWeight: FontWeight.medium, flexShrink: 1 },
  optionsRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  colorCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  circleSelected: { borderColor: colors.textPrimary },

  // 🚀 Styles for Icon Picker
  iconScrollRow: { gap: 12, marginBottom: Spacing.xl },
  iconBox: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

  saveBtn: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.background, fontSize: FontSize.md, lineHeight: 22, fontWeight: FontWeight.bold, textAlign: 'center', flexShrink: 1 },
});
