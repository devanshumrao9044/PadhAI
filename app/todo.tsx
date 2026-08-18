import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, SafeAreaView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { loadTodoItems, saveTodoItems } from '@/services/productivity';
import type { TodoItem } from '@/types/models';

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDays(): Date[] {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function TodoScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user, subjects } = useApp();
  const weekDays = useMemo(getWeekDays, []);
  const today = dateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    void loadTodoItems(user.id).then(saved => {
      if (mounted) setItems(saved);
    });
    return () => { mounted = false; };
  }, [user?.id]);

  const persist = (next: TodoItem[]) => {
    setItems(next);
    if (user?.id) void saveTodoItems(user.id, next);
  };

  const visibleItems = useMemo(
    () => items.filter(item => item.date === selectedDate),
    [items, selectedDate],
  );

  const toggleItem = (id: string) => {
    persist(items.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const addItem = async () => {
    if (!user?.id || !title.trim()) return;
    setSaving(true);
    const item: TodoItem = {
      id: `${user.id}-todo-${Date.now()}`,
      userId: user.id,
      title: title.trim(),
      subjectId: selectedSubjectId,
      date: selectedDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    persist([item, ...items]);
    setTitle('');
    setSelectedSubjectId(null);
    setModalVisible(false);
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel={t('todo.back')}>
          <MaterialIcons name="arrow-back" size={23} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('todo.title')}</Text>
          <Text style={styles.subtitle}>{t('todo.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} accessibilityLabel={t('todo.addTask')}>
          <MaterialIcons name="add" size={22} color={colors.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={weekDays}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={day => dateKey(day)}
        contentContainerStyle={styles.weekRibbon}
        renderItem={({ item: day }) => {
          const key = dateKey(day);
          const active = key === selectedDate;
          const isToday = key === today;
          return (
            <Pressable
              onPress={() => setSelectedDate(key)}
              style={[styles.dayCard, active && styles.dayCardActive]}
              accessibilityRole="button"
              accessibilityLabel={`${day.toLocaleDateString(undefined, { weekday: 'long' })} ${day.getDate()}`}
            >
              <Text style={[styles.dayName, active && styles.dayNameActive]}>
                {day.toLocaleDateString(undefined, { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNumber, active && styles.dayNumberActive]}>{day.getDate()}</Text>
              {isToday ? <View style={[styles.todayDot, active && styles.todayDotActive]} /> : null}
            </Pressable>
          );
        }}
      />

      <View style={styles.contentHeader}>
        <View>
          <Text style={styles.sectionTitle}>{t('todo.tasksFor')}</Text>
          <Text style={styles.dateText}>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</Text>
        </View>
        <Text style={styles.countText}>{visibleItems.filter(item => !item.completed).length} {t('todo.remaining')}</Text>
      </View>

      {visibleItems.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="checklist" size={50} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>{t('todo.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('todo.emptyText')}</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.emptyButtonText}>{t('todo.addTask')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.taskList}
          renderItem={({ item }) => {
            const subject = subjects.find(value => value.id === item.subjectId);
            return (
              <Pressable style={styles.taskCard} onPress={() => toggleItem(item.id)}>
                <MaterialIcons
                  name={item.completed ? 'check-circle' : 'radio-button-unchecked'}
                  size={25}
                  color={item.completed ? colors.success : colors.textTertiary}
                />
                <View style={styles.taskCopy}>
                  <Text style={[styles.taskTitle, item.completed && styles.taskCompleted]}>{item.title}</Text>
                  <Text style={styles.taskMeta}>{subject?.name ?? t('todo.general')}</Text>
                </View>
                <MaterialIcons name="drag-handle" size={20} color={colors.textTertiary} />
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('todo.newTask')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel={t('todo.close')}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('todo.taskPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoFocus
              maxLength={80}
            />
            <Text style={styles.fieldLabel}>{t('todo.subject')}</Text>
            <View style={styles.subjectOptions}>
              <Pressable style={[styles.subjectChip, selectedSubjectId === null && styles.subjectChipActive]} onPress={() => setSelectedSubjectId(null)}>
                <Text style={[styles.subjectChipText, selectedSubjectId === null && styles.subjectChipTextActive]}>{t('todo.general')}</Text>
              </Pressable>
              {subjects.map(subject => (
                <Pressable key={subject.id} style={[styles.subjectChip, selectedSubjectId === subject.id && { backgroundColor: subject.colorHex, borderColor: subject.colorHex }]} onPress={() => setSelectedSubjectId(subject.id)}>
                  <Text style={[styles.subjectChipText, selectedSubjectId === subject.id && styles.subjectChipTextActive]}>{subject.name}</Text>
                </Pressable>
              ))}
            </View>
            <TouchableOpacity style={[styles.saveButton, (!title.trim() || saving) && styles.disabled]} disabled={!title.trim() || saving} onPress={addItem}>
              {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveButtonText}>{t('todo.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: 10 },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 3 },
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  weekRibbon: { paddingHorizontal: Spacing.md, gap: 8, paddingBottom: Spacing.md },
  dayCard: { width: 54, minHeight: 68, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  dayNameActive: { color: colors.background },
  dayNumber: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  dayNumberActive: { color: colors.background },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  todayDotActive: { backgroundColor: colors.background },
  contentHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  dateText: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  countText: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  taskList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 120 },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.md },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  taskCompleted: { textDecorationLine: 'line-through', color: colors.textTertiary },
  taskMeta: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyText: { color: colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  emptyButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 12, marginTop: Spacing.sm },
  emptyButtonText: { color: colors.background, fontWeight: FontWeight.bold },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sheetTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.surfaceVariant, color: colors.textPrimary, paddingHorizontal: Spacing.md, paddingVertical: 14, fontSize: FontSize.base },
  fieldLabel: { color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, marginTop: Spacing.md, marginBottom: Spacing.sm },
  subjectOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceVariant, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  subjectChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subjectChipText: { color: colors.textSecondary, fontSize: FontSize.sm },
  subjectChipTextActive: { color: colors.background, fontWeight: FontWeight.semiBold },
  saveButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.xl },
  saveButtonText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  disabled: { opacity: 0.5 },
  close: { color: colors.textSecondary },
});
