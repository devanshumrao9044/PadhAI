import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Modal } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext'; // ✅ FIXED: Imported Language Context for i18n
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import type { Chapter } from '@/types/models';

// ✅ FIXED: Helper function for Local Timezone date string
function getLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const STATUS_ICONS: Record<Chapter['status'], string> = {
  not_started: 'radio-button-unchecked',
  in_progress: 'pending',
  done: 'check-circle',
  weak: 'warning',
};

const STATUS_OPTIONS: Chapter['status'][] = ['not_started', 'in_progress', 'done', 'weak'];

interface ChapterItemProps {
  chapter: Chapter;
  onStatusChange: (status: Chapter['status']) => void;
  onPress: () => void;
  onDelete: () => void;
  onStartFocus: () => void;
}

export default function ChapterItem({ chapter, onStatusChange, onPress, onDelete, onStartFocus }: ChapterItemProps) {
  const { colors } = useTheme();
  const { t } = useLanguage(); // ✅ FIXED: Hook for translations
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const statusColors = useMemo(() => ({
    not_started: colors.textTertiary,
    in_progress: colors.accent,
    done: colors.success,
    weak: colors.warning,
  }), [colors]);

  // ✅ FIXED: Moved inside to use translation hook
  const STATUS_LABELS: Record<Chapter['status'], string> = {
    not_started: t('status.notStarted') || 'Not Started',
    in_progress: t('status.inProgress') || 'In Progress',
    done: t('status.done') || 'Done',
    weak: t('status.weak') || 'Weak',
  };

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const color = statusColors[chapter.status];
  
  // ✅ FIXED: Using Local Date instead of UTC Date
  const isOverdue = chapter.plannedDate && chapter.status !== 'done' && chapter.plannedDate < getLocalDateStr();

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
        onPress={onPress}
      >
        <TouchableOpacity
          onPress={() => setShowStatusMenu(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name={STATUS_ICONS[chapter.status] as any} size={22} color={color} />
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={[styles.name, chapter.status === 'done' ? styles.nameDone : null]}>
            {chapter.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.statusPill, { backgroundColor: color + '22', borderColor: color + '44' }]}>
              <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[chapter.status]}</Text>
            </View>
            {isOverdue ? (
              <View style={styles.overduePill}>
                <MaterialIcons name="schedule" size={10} color={colors.danger} />
                <Text style={styles.overdueText}>{t('tracker.overdue') || 'Overdue'}</Text>
              </View>
            ) : null}
            {chapter.plannedDate ? (
              <Text style={styles.dateText}>{chapter.plannedDate}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onStartFocus}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common.startFocus') || "Start focus"}
          >
            <MaterialIcons name="play-arrow" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="delete-outline" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          <MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} />
        </View>
      </Pressable>

      {/* Status picker */}
      <Modal visible={showStatusMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusMenu(false)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{t('tracker.changeStatus') || 'Change Status'}</Text>
            {STATUS_OPTIONS.map(s => {
              const sc = statusColors[s];
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.menuItem, chapter.status === s ? styles.menuItemActive : null]}
                  onPress={() => { onStatusChange(s); setShowStatusMenu(false); }}
                >
                  <MaterialIcons name={STATUS_ICONS[s] as any} size={18} color={sc} />
                  <Text style={[styles.menuItemText, { color: sc }]}>{STATUS_LABELS[s]}</Text>
                  {chapter.status === s ? <MaterialIcons name="check" size={16} color={sc} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm, gap: 10,
  },
  rowPressed: { opacity: 0.85 },
  info: { flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.textPrimary, includeFontPadding: false },
  nameDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  statusPill: {
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  overduePill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.danger + '22', borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  overdueText: { fontSize: FontSize.xs, color: colors.danger },
  dateText: { fontSize: FontSize.xs, color: colors.textTertiary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  menuCard: {
    backgroundColor: colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: Spacing.lg, width: '100%',
  },
  menuTitle: {
    fontSize: FontSize.base, fontWeight: FontWeight.semiBold,
    color: colors.textSecondary, marginBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderRadius: Radius.md,
    paddingHorizontal: 8,
  },
  menuItemActive: { backgroundColor: colors.surfaceVariant },
  menuItemText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
});
