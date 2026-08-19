import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { loadCalendarEvents, saveCalendarEvents } from '@/services/productivity';
import type { CalendarEvent } from '@/types/models';

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthDays(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= total; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day, 12));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useApp();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [isDayOff, setIsDayOff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    void loadCalendarEvents(user.id).then(saved => {
      if (mounted) setEvents(saved);
    });
    return () => { mounted = false; };
  }, [user?.id]);

  const persist = (next: CalendarEvent[]) => {
    setEvents(next);
    if (user?.id) void saveCalendarEvents(user.id, next);
  };

  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const selectedEvents = events.filter(event => event.date === selectedDate);
  const today = dateKey(new Date());

  const shiftMonth = (delta: number) => {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  };

  const deleteEvent = () => {
    if (!deleteTarget) return;
    persist(events.filter(event => event.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const addEvent = async () => {
    if (!user?.id || (!title.trim() && !isDayOff)) return;
    setSaving(true);
    const event: CalendarEvent = {
      id: `${user.id}-calendar-${Date.now()}`,
      userId: user.id,
      title: title.trim() || t('calendar.dayOff'),
      date: selectedDate,
      isDayOff,
      createdAt: new Date().toISOString(),
    };
    persist([event, ...events]);
    setTitle('');
    setIsDayOff(false);
    setModalVisible(false);
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel={t('calendar.back')}>
          <MaterialIcons name="arrow-back" size={23} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('calendar.title')}</Text>
          <Text style={styles.subtitle}>{t('calendar.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} accessibilityLabel={t('calendar.addEvent')}>
          <MaterialIcons name="add" size={22} color={colors.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthButton} accessibilityLabel={t('calendar.previousMonth')}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthButton} accessibilityLabel={t('calendar.nextMonth')}>
          <MaterialIcons name="chevron-right" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
          <Text key={day} style={styles.weekLabel}>{t(`calendar.${day}` as any)}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {monthDays.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const key = dateKey(day);
          const active = key === selectedDate;
          const isToday = key === today;
          const hasEvent = events.some(event => event.date === key);
          return (
            <Pressable key={key} style={styles.dayCell} onPress={() => { setSelectedDate(key); setModalVisible(true); }}>
              <View style={[styles.dayCircle, active && styles.dayCircleActive, isToday && !active && styles.dayCircleToday]}>
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{day.getDate()}</Text>
              </View>
              {hasEvent ? <View style={[styles.eventDot, active && styles.eventDotActive]} /> : <View style={styles.eventDotPlaceholder} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.eventsHeader}>
        <View>
          <Text style={styles.sectionTitle}>{t('calendar.eventsFor')}</Text>
          <Text style={styles.dateText}>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Text style={styles.addText}>{t('calendar.addEvent')}</Text>
        </TouchableOpacity>
      </View>

      {selectedEvents.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="event-note" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>{t('calendar.noEvents')}</Text>
          <Text style={styles.emptyText}>{t('calendar.noEventsHint')}</Text>
        </View>
      ) : (
        <View style={styles.eventList}>
          {selectedEvents.map(event => (
            <View key={event.id} style={[styles.eventCard, event.isDayOff && styles.dayOffCard]}>
              <MaterialIcons name={event.isDayOff ? 'free-breakfast' : 'event'} size={23} color={event.isDayOff ? colors.warning : colors.primary} />
                <View style={styles.eventCopy}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventMeta}>{event.isDayOff ? t('calendar.dayOff') : t('calendar.studyEvent')}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDeleteTarget(event)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('calendar.deleteEvent')}: ${event.title}`}
                >
                  <MaterialIcons name="delete-outline" size={21} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
          ))}
        </View>
      )}

      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('calendar.deleteConfirmTitle')}</Text>
            <Text style={styles.confirmText}>{t('calendar.deleteConfirmText')}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.cancelButtonText}>{t('calendar.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmButton} onPress={deleteEvent}>
                <Text style={styles.deleteConfirmButtonText}>{t('calendar.deleteEvent')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('calendar.newEvent')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel={t('calendar.close')}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.selectedDateLabel}>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('calendar.eventPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoFocus={!isDayOff}
              maxLength={80}
            />
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>{t('calendar.dayOff')}</Text>
                <Text style={styles.switchHint}>{t('calendar.dayOffHint')}</Text>
              </View>
              <Switch value={isDayOff} onValueChange={setIsDayOff} trackColor={{ false: colors.surfaceVariant, true: colors.primaryDim }} thumbColor={isDayOff ? colors.primary : colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveButton, (!title.trim() && !isDayOff || saving) && styles.disabled]} disabled={(!title.trim() && !isDayOff) || saving} onPress={addEvent}>
              {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveButtonText}>{t('calendar.save')}</Text>}
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
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  monthButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceVariant },
  monthTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  weekHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  weekLabel: { flex: 1, textAlign: 'center', color: colors.textTertiary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: Spacing.sm },
  dayCell: { width: '14.2857%', minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayCircleActive: { backgroundColor: colors.primary },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  dayTextActive: { color: colors.background, fontWeight: FontWeight.bold },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  eventDotActive: { backgroundColor: colors.background },
  eventDotPlaceholder: { width: 5, height: 5 },
  eventsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  dateText: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  addText: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  eventList: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md },
  dayOffCard: { borderColor: colors.warning + '88', backgroundColor: colors.warning + '12' },
  eventCopy: { flex: 1, minWidth: 0 },
  deleteButton: { padding: 4 },
  eventTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  eventMeta: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyText: { color: colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sheetTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  selectedDateLabel: { color: colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.surfaceVariant, color: colors.textPrimary, paddingHorizontal: Spacing.md, paddingVertical: 14, fontSize: FontSize.base },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: Spacing.lg },
  switchCopy: { flex: 1 },
  switchTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  switchHint: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 3 },
  saveButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  confirmOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  confirmCard: { width: '100%', backgroundColor: colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg },
  confirmTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 6 },
  confirmText: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 21, marginBottom: Spacing.lg },
  confirmActions: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, backgroundColor: colors.surfaceVariant, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: colors.textSecondary, fontWeight: FontWeight.semiBold },
  deleteConfirmButton: { flex: 1, backgroundColor: colors.danger, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  deleteConfirmButtonText: { color: colors.textPrimary, fontWeight: FontWeight.bold },
  disabled: { opacity: 0.5 },
});
