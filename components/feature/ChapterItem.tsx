import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import type { Chapter } from '@/types/models';

const STATUS_COLORS: Record<Chapter['status'], string> = {
  not_started: Colors.textTertiary,
  in_progress: Colors.accent,
  done: Colors.success,
  weak: Colors.warning,
};

const STATUS_LABELS: Record<Chapter['status'], string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
  weak: 'Weak',
};

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
}

export default function ChapterItem({ chapter, onStatusChange, onPress, onDelete }: ChapterItemProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const color = STATUS_COLORS[chapter.status];
  const isOverdue = chapter.plannedDate && chapter.status !== 'done' && chapter.plannedDate < new Date().toISOString().split('T')[0];

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
                <MaterialIcons name="schedule" size={10} color={Colors.danger} />
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            ) : null}
            {chapter.plannedDate ? (
              <Text style={styles.dateText}>{chapter.plannedDate}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="delete-outline" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
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
            <Text style={styles.menuTitle}>Status change karo</Text>
            {STATUS_OPTIONS.map(s => {
              const sc = STATUS_COLORS[s];
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm, gap: 10,
  },
  rowPressed: { opacity: 0.85 },
  info: { flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary, includeFontPadding: false },
  nameDone: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  statusPill: {
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  overduePill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.danger + '22', borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  overdueText: { fontSize: FontSize.xs, color: Colors.danger },
  dateText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuOverlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  menuCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, width: '100%',
  },
  menuTitle: {
    fontSize: FontSize.base, fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary, marginBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderRadius: Radius.md,
    paddingHorizontal: 8,
  },
  menuItemActive: { backgroundColor: Colors.surfaceVariant },
  menuItemText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
});
