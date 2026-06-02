import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, Image, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase'; // 🚀 Ensure this path matches your project
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getLevelForXP, getXPProgress, LEVELS } from '@/constants/levels';
import XPBar from '@/components/ui/XPBar';

export default function ProfileScreen() {
  const { user, setUser, sessions, chapters, xpLog } = useApp();
  
  // States for Edit Modal
  const [editVisible, setEditVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form States
  const [editName, setEditName] = useState('');
  const [editExam, setEditExam] = useState('JEE');
  const [editClass, setEditClass] = useState('12th');
  const [editGoal, setEditGoal] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false, title: '', message: '',
  });

  if (!user) return null;

  const level = getLevelForXP(user.xpTotal);
  const progress = getXPProgress(user.xpTotal);
  const totalHours = Math.floor(sessions.reduce((s, x) => s + x.durationActualMins, 0) / 60);
  const doneChapters = chapters.filter(c => !c.isDeleted && c.status === 'done').length;
  const joinDate = new Date(user.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const initials = user.fullName?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'ST';
  const displayAvatar = user.avatarUrl || editAvatarUrl;

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message });
    } else {
      Alert.alert(title, message);
    }
  };

  // Open Edit Modal with Current Data
  const openEditModal = () => {
    setEditName(user.fullName || '');
    setEditExam(user.targetExam || 'JEE');
    setEditClass(user.classLevel || '12th');
    setEditGoal(String(user.dailyGoalMinutes || 120));
    setEditAvatarUrl(user.avatarUrl || '');
    setEditVisible(true);
  };

  // Handle Image Pick
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'Gallery access is required to change photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setEditAvatarUrl(result.assets[0].uri);
    }
  };

  // Save All Changes to Supabase & Context
  const handleSaveProfile = async () => {
    const mins = parseInt(editGoal);
    if (!editName.trim()) {
      showAlert('Error', 'Can not leave name blank !');
      return;
    }
    if (isNaN(mins) || mins < 15 || mins > 720) {
      showAlert('Invalid Goal', 'The goal must be between 15 and 720 minutes.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        // Save to Supabase DB
        await supabase
          .from('users')
          .update({
            name: editName,
            target_exam: editExam,
            class_level: editClass,
            daily_goal_minutes: mins,
            avatar_url: editAvatarUrl,
          })
          .eq('id', authUser.id);
      }

      // Update Local State (Context)
      await setUser({
        ...user,
        fullName: editName,
        targetExam: editExam,
        classLevel: editClass,
        dailyGoalMinutes: mins,
        avatarUrl: editAvatarUrl,
      });

      setEditVisible(false);
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Profile could not be saved. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const recentXP = xpLog.slice(0, 10);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* 🚀 CENTERED PROFILE HEADER */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarInitials, { backgroundColor: level.color + '33' }]}>
                <Text style={[styles.avatarText, { color: level.color }]}>{initials}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.fullName}</Text>
            <Text style={styles.profileSub}>@{user.username || 'student'}</Text>
            <View style={styles.examBadge}>
              <Text style={styles.examBadgeText}>{user.targetExam || 'JEE'} • Class {user.classLevel || '12th'}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal}>
            <MaterialIcons name="edit" size={16} color={Colors.background} />
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Level + XP Card */}
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

        {/* Stats Grid */}
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

        {/* Level Roadmap */}
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
          <Text style={styles.cardTitle}>ACCOUNT INFO</Text>
          <View style={styles.settingRow}>
            <MaterialIcons name="flag" size={20} color={Colors.primary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Daily Goal</Text>
              <Text style={styles.settingValue}>{user.dailyGoalMinutes} minutes</Text>
            </View>
          </View>
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

      {/* 🚀 FULL EDIT PROFILE MODAL */}
      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              
              {/* Avatar Edit */}
              <TouchableOpacity style={styles.modalAvatarEdit} onPress={pickImage}>
                {editAvatarUrl ? (
                  <Image source={{ uri: editAvatarUrl }} style={styles.avatarImageSmall} />
                ) : (
                  <View style={[styles.avatarInitials, { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceVariant }]}>
                    <MaterialIcons name="person" size={30} color={Colors.textSecondary} />
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <MaterialIcons name="photo-camera" size={14} color="#FFF" />
                </View>
              </TouchableOpacity>

              {/* Name Input */}
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor={Colors.textTertiary}
              />

              {/* Exam Selectors */}
              <Text style={styles.inputLabel}>TARGET EXAM</Text>
              <View style={styles.chipRow}>
                {['JEE', 'NEET', 'BOARDS'].map(exam => (
                  <TouchableOpacity 
                    key={exam} 
                    style={[styles.chip, editExam === exam && styles.chipActive]}
                    onPress={() => setEditExam(exam)}
                  >
                    <Text style={[styles.chipText, editExam === exam && styles.chipTextActive]}>{exam}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Class Selectors */}
              <Text style={styles.inputLabel}>CLASS</Text>
              <View style={styles.chipRow}>
                {['11th', '12th', 'Dropper'].map(cls => (
                  <TouchableOpacity 
                    key={cls} 
                    style={[styles.chip, editClass === cls && styles.chipActive]}
                    onPress={() => setEditClass(cls)}
                  >
                    <Text style={[styles.chipText, editClass === cls && styles.chipTextActive]}>{cls}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Goal Input */}
              <Text style={styles.inputLabel}>DAILY GOAL (MINUTES)</Text>
              <TextInput
                style={styles.input}
                value={editGoal}
                onChangeText={setEditGoal}
                keyboardType="number-pad"
                placeholder="e.g. 120"
                placeholderTextColor={Colors.textTertiary}
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={Colors.background} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Web Alert Modal */}
      {Platform.OS === 'web' ? (
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={styles.alertOverlay}>
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
  scrollView: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  
  // 🚀 Centered Profile Header Styles
  profileHeader: {
    alignItems: 'center', 
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  avatarContainer: { position: 'relative', marginBottom: Spacing.sm },
  avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: Colors.primary },
  avatarInitials: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, includeFontPadding: false },
  profileInfo: { alignItems: 'center', marginBottom: Spacing.md },
  profileName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  examBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
    borderWidth: 1, borderColor: Colors.primary + '55',
  },
  examBadgeText: { fontSize: FontSize.xs, color: Colors.primaryGlow, fontWeight: FontWeight.semiBold },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
  },
  editProfileBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Level & Stats Styles
  levelCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md,
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
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md,
  },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, includeFontPadding: false },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary, letterSpacing: 1.2, marginBottom: Spacing.sm, textTransform: 'uppercase',
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: 0.4 },
  levelRowUnlocked: { opacity: 1 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelRowInfo: { flex: 1 },
  levelRowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  levelRowSub: { fontSize: FontSize.xs, color: Colors.textTertiary },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  settingValue: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  xpReason: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'capitalize' },
  xpAmount: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  
  // 🚀 Edit Modal Styles
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, marginTop: 'auto', borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
  modalAvatarEdit: { alignSelf: 'center', marginBottom: Spacing.lg, position: 'relative' },
  avatarImageSmall: { width: 64, height: 64, borderRadius: 32 },
  cameraIconBadge: {
    position: 'absolute', bottom: 0, right: -4, backgroundColor: Colors.primary,
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  inputLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    flex: 1, backgroundColor: Colors.surfaceVariant, paddingVertical: 10, borderRadius: Radius.md,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  chipTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  
  // Alert Styles
  alertOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center' },
  alertBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, margin: Spacing.xl },
  alertTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 8 },
  alertMsg: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.md },
  alertBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
});

