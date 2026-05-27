import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Pressable, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getLevelForXP, getXPProgress, LEVELS } from '@/constants/levels';
import XPBar from '@/components/ui/XPBar';

export default function ProfileScreen() {
  const { user, setUser, sessions, chapters, xpLog } = useApp();
  const [editVisible, setEditVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false, title: '', message: '',
  });

  if (!user) return null;

  const level = getLevelForXP(user.xpTotal);
  const progress = getXPProgress(user.xpTotal);
  const totalHours = Math.floor(sessions.reduce((s, x) => s + x.durationActualMins, 0) / 60);
  const doneChapters = chapters.filter(c => !c.isDeleted && c.status === 'done').length;
  const joinDate = new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const initials = user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message });
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSaveGoal = async () => {
    const mins = parseInt(goalInput);
    if (isNaN(mins) || mins < 15 || mins > 720) {
      showAlert('Invalid', '15 se 720 minutes ke beech enter karo');
      return;
    }
    await setUser({ ...user, dailyGoalMinutes: mins });
    setEditVisible(false);
  };

  const recentXP = xpLog.slice(0, 10);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: level.color + '33' }]}>
            <Text style={[styles.avatarText, { color: level.color }]}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.fullName}</Text>
            <Text style={styles.profileSub}>@{user.username}</Text>
            <View style={styles.examBadge}>
              <Text style={styles.examBadgeText}>{user.targetExam} • Class {user.classLevel}</Text>
            </View>
          </View>
        </View>

        {/* Level + XP */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={[styles.levelTitle, { color: level.color }]}>{level.realisticTitle}</Text>
              <Text style={styles.levelExam}>{level.examTitle}</Text>
            </View>
            <View style={styles.xpBadge}>
              <MaterialIcons name="bolt" size={16} color={Colors.warning} />
              <Text style={styles.xpBadgeText}>{user.xpTotal} XP</Text>
            </View>
          </View>
          <XPBar xp={user.xpTotal} />
          <Text style={styles.xpNeeded}>
            {progress.needed - progress.current} XP more to next level
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <MaterialIcons name="local-fire-department" size={22} color={Colors.danger} />
            <Text style={styles.statVal}>{user.streakCurrent}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="emoji-events" size={22} color={Colors.warning} />
            <Text style={styles.statVal}>{user.streakLongest}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="schedule" size={22} color={Colors.accent} />
            <Text style={styles.statVal}>{totalHours}h</Text>
            <Text style={styles.statLabel}>Total Study</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="check-circle" size={22} color={Colors.success} />
            <Text style={styles.statVal}>{doneChapters}</Text>
            <Text style={styles.statLabel}>Chapters Done</Text>
          </View>
        </View>

        {/* All levels */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LEVEL ROADMAP</Text>
          {LEVELS.map(l => (
            <View key={l.rank} style={[styles.levelRow, user.xpTotal >= l.minXP ? styles.levelRowUnlocked : null]}>
              <View style={[styles.levelDot, { backgroundColor: user.xpTotal >= l.minXP ? l.color : Colors.textTertiary }]} />
              <View style={styles.levelRowInfo}>
                <Text style={[styles.levelRowTitle, { color: user.xpTotal >= l.minXP ? l.color : Colors.textTertiary }]}>
                  {l.realisticTitle}
                </Text>
                <Text style={styles.levelRowSub}>{l.examTitle} • {l.minXP}+ XP</Text>
              </View>
              {user.xpTotal >= l.minXP ? (
                <MaterialIcons name="check-circle" size={18} color={l.color} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SETTINGS</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => { setGoalInput(String(user.dailyGoalMinutes)); setEditVisible(true); }}>
            <MaterialIcons name="flag" size={20} color={Colors.primary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Daily Goal</Text>
              <Text style={styles.settingValue}>{user.dailyGoalMinutes} minutes</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.settingRow}>
            <MaterialIcons name="calendar-today" size={20} color={Colors.textSecondary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Member Since</Text>
              <Text style={styles.settingValue}>{joinDate}</Text>
            </View>
          </View>
        </View>

        {/* Recent XP log */}
        {recentXP.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>RECENT XP</Text>
            {recentXP.map(tx => (
              <View key={tx.id} style={styles.xpRow}>
                <MaterialIcons
                  name={tx.amount > 0 ? 'add-circle' : 'remove-circle'}
                  size={16}
                  color={tx.amount > 0 ? Colors.success : Colors.danger}
                />
                <Text style={styles.xpReason}>{tx.reason.replace(/_/g, ' ')}</Text>
                <Text style={[styles.xpAmount, { color: tx.amount > 0 ? Colors.success : Colors.danger }]}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount} XP
                </Text>
              </View>
            ))}
          </View>
        ) : null}

      </ScrollView>

      {/* Edit Goal Modal */}
      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Daily Goal Edit Karo</Text>
            <TextInput
              style={styles.input}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="number-pad"
              placeholder="Minutes (e.g. 120)"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
            <Text style={styles.inputHint}>15 to 720 minutes allowed</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGoal}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Web Alert Modal */}
      {Platform.OS === 'web' ? (
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>{alertConfig.title}</Text>
              <Text style={styles.alertMsg}>{alertConfig.message}</Text>
              <TouchableOpacity
                style={styles.alertBtn}
                onPress={() => setAlertConfig(p => ({ ...p, visible: false }))}
              >
                <Text style={styles.saveBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xl },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, includeFontPadding: false },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, includeFontPadding: false },
  profileSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  examBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '22', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 6,
    borderWidth: 1, borderColor: Colors.primary + '55',
  },
  examBadgeText: { fontSize: FontSize.xs, color: Colors.primaryGlow, fontWeight: FontWeight.semiBold },
  levelCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  levelTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, includeFontPadding: false },
  levelExam: { fontSize: FontSize.sm, color: Colors.textSecondary },
  xpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '22', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  xpBadgeText: { fontSize: FontSize.base, color: Colors.warning, fontWeight: FontWeight.semiBold },
  xpNeeded: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6 },
  statsGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, includeFontPadding: false },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 1.2,
    marginBottom: Spacing.sm, textTransform: 'uppercase',
  },
  levelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, opacity: 0.4,
  },
  levelRowUnlocked: { opacity: 1 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelRowInfo: { flex: 1 },
  levelRowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  levelRowSub: { fontSize: FontSize.xs, color: Colors.textTertiary },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  settingValue: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  xpReason: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'capitalize' },
  xpAmount: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    color: Colors.textPrimary, fontSize: FontSize.md,
  },
  inputHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6, marginBottom: Spacing.md },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, margin: Spacing.xl,
  },
  alertTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 8 },
  alertMsg: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.md },
  alertBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
});
