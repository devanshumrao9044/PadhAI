import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import type { Subject } from '@/types/models';

interface SubjectCardProps {
  subject: Subject;
  chapterCount: number;
  doneCount: number;
  weakCount: number;
  onPress: () => void;
  onDelete: () => void;
}

export default function SubjectCard({
  subject, chapterCount, doneCount, weakCount, onPress, onDelete,
}: SubjectCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progress = chapterCount > 0 ? doneCount / chapterCount : 0;

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={onPress}
      >
        <View style={styles.topRow}>
          <View style={[styles.colorBar, { backgroundColor: subject.colorHex }]} />
          <View style={styles.info}>
            <Text style={styles.name}>{subject.name}</Text>
            <Text style={styles.meta}>
              {chapterCount} chapters
              {weakCount > 0 ? ` • ${weakCount} weak` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setConfirmDelete(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <MaterialIcons name="delete-outline" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
          <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
        </View>

        {/* Progress bar */}
        {chapterCount > 0 ? (
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${progress * 100}%` as any,
                backgroundColor: subject.colorHex,
              }]} />
            </View>
            <Text style={styles.progressText}>{doneCount}/{chapterCount} done</Text>
          </View>
        ) : null}
      </Pressable>

      {/* Delete confirmation */}
      <Modal visible={confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>"{subject.name}" delete karo?</Text>
            <Text style={styles.confirmSub}>All chapters will be removed.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => { onDelete(); setConfirmDelete(false); }}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorBar: { width: 4, height: 44, borderRadius: 2 },
  info: { flex: 1 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, includeFontPadding: false },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 4 },
  progressSection: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: Spacing.sm, paddingLeft: 14,
  },
  progressTrack: {
    flex: 1, height: 3, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: Radius.full },
  progressText: { fontSize: FontSize.xs, color: Colors.textTertiary, width: 60, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  confirmCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, width: '100%',
  },
  confirmTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6 },
  confirmSub: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.lg },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semiBold },
  deleteConfirmBtn: {
    flex: 1, backgroundColor: Colors.danger,
    borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center',
  },
  deleteConfirmText: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
});
