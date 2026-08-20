import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, Image, ActivityIndicator, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { useAuthSession } from '@/auth/AuthSessionProvider';
import { getLevelForUser, getXPProgressForUser, LEVELS } from '@/constants/levels';
import XPBar from '@/components/ui/XPBar';
import { getRecentSessions } from '@/services/sessionHistory';
import { loadTodoItems } from '@/services/productivity';
import { fetchReferralStats } from '@/services/referralService';
import { getWeeklyZone } from '@/services/weeklyXp';
import { STUDY_GOALS, PROFILE_LEARNER_TYPES } from '@/constants/studyGoals';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  syncLocalNotifications,
} from '@/services/localNotifications';
import { disableNotificationDevice, isNotificationAdmin, registerNotificationDevice } from '@/services/adminNotifications';
import type { NotificationSettings } from '@/types/models';
import {
  formatFileSize,
  getImageByteSize,
  MAX_AVATAR_OUTPUT_BYTES,
  MAX_AVATAR_SOURCE_BYTES,
  prepareAvatarImage,
} from '@/services/avatarImage';

export default function ProfileScreen() {
  const { colors, mode, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, setUser, sessions, chapters } = useApp();
  const router = useRouter();
  const { signOut, signingOut } = useAuthSession();
  const userId = user?.id;

  const [editVisible, setEditVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rankInfo, setRankInfo] = useState<{
    rank: number; total: number; zone: string; color: string;
  } | null>(null);

  const [editName, setEditName] = useState('');
  const [editExam, setEditExam] = useState('OTHER');
  const [editClass, setEditClass] = useState('SELF_STUDY');
  const [editGoal, setEditGoal] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [adminRole, setAdminRole] = useState<'owner' | 'admin' | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean; title: string; message: string; isSignOut?: boolean;
  }>({ visible: false, title: '', message: '' });
  const [referralStats, setReferralStats] = useState({
    myCode: null as string | null,
    completed: 0,
    pending: 0,
    hasUnlockedReward: false,
  });

  useEffect(() => {
    async function fetchRankInfo() {
      if (!userId) return;
      try {
        const { data, error } = await supabase.rpc('get_leaderboard');
        if (!error && data) {
          const total = data.length;
          const safeTotal = Math.max(1, total);
          const myEntry = data.find((e: any) => e.id === userId);
          const rank = Math.min(safeTotal, Math.max(1, Number(myEntry?.rank ?? safeTotal)));
          const weeklyZone = getWeeklyZone(rank, safeTotal);
          const zone = weeklyZone === 'promotion' ? 'Promotion' : weeklyZone === 'safety' ? 'Safety' : 'Demotion';
          const color = weeklyZone === 'promotion' ? colors.success : weeklyZone === 'safety' ? colors.warning : colors.danger;
          setRankInfo({ rank, total, zone, color });
        }
      } catch (e) {
        console.log('Rank fetch error:', e);
      }
    }
    fetchRankInfo();
  }, [userId, colors]);

  useEffect(() => {
    if (!userId) {
      setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
      setAdminRole(null);
      return;
    }
    let active = true;
    void Promise.all([loadNotificationSettings(userId), loadTodoItems(userId), isNotificationAdmin(userId)]).then(([settings, todoItems, role]) => {
      if (!active) return;
      setNotificationSettings(settings);
      setAdminRole(role.allowed ? role.role : null);
      const hasPendingTodo = todoItems.some(item => !item.completed && item.date >= new Date().toISOString().slice(0, 10));
      void syncLocalNotifications(settings, language, hasPendingTodo);
    });
    return () => { active = false; };
  }, [userId, language]);

  const updateNotificationSettings = async (patch: Partial<NotificationSettings>) => {
    if (!userId || notificationBusy) return;
    const next = { ...notificationSettings, ...patch };
    setNotificationBusy(true);
    try {
      const todoItems = await loadTodoItems(userId);
      const hasPendingTodo = todoItems.some(item => !item.completed && item.date >= new Date().toISOString().slice(0, 10));
      const synced = await syncLocalNotifications(next, language, hasPendingTodo);
      const deviceReady = next.enabled ? await registerNotificationDevice(userId) : await disableNotificationDevice(userId);
      if (!synced && next.enabled) {
        Alert.alert(
          t('profile.notifications'),
          Platform.OS === 'web' ? t('profile.notificationsWebUnavailable') : t('profile.notificationsPermissionDenied'),
          );
        return;
      }
      setNotificationSettings(next);
      await saveNotificationSettings(userId, next);
      if (next.enabled && Platform.OS !== 'web' && !deviceReady) {
        Alert.alert(t('profile.notifications'), t('profile.notificationsDeviceSetupFailed'));
      }
    } finally {
      setNotificationBusy(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setReferralStats({ myCode: null, completed: 0, pending: 0, hasUnlockedReward: false });
      return;
    }
    let active = true;
    fetchReferralStats(userId).then(stats => {
      if (active) setReferralStats(stats);
    });
    return () => { active = false; };
  }, [userId]);

  const level = useMemo(() => getLevelForUser({ xpTotal: user?.xpTotal ?? 0, levelRank: user?.levelRank }), [user?.xpTotal, user?.levelRank]);
  const progress = useMemo(() => getXPProgressForUser({ xpTotal: user?.xpTotal ?? 0, levelRank: user?.levelRank }), [user?.xpTotal, user?.levelRank]);
  const totalHours = useMemo(
    () => Math.floor(sessions.reduce((s, x) => s + x.durationActualMins, 0) / 60),
    [sessions],
  );
  const doneChapters = useMemo(
    () => chapters.filter(c => !c.isDeleted && c.status === 'done').length,
    [chapters],
  );
  const joinDate = useMemo(() => new Date(user?.createdAt || Date.now()).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }), [language, user?.createdAt]);
  const initials = useMemo(() => user?.fullName?.split(' ')
    .map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'ST', [user?.fullName]);
  const displayAvatar = (user as any)?.avatarUrl || editAvatarUrl;
  const localizedLevelCopy = useMemo(() => ({
    1: { title: t('profile.levelBeginner'), exam: t('profile.levelFresher') },
    2: { title: t('profile.levelGrinder'), exam: t('profile.levelClass11') },
    3: { title: t('profile.levelConsistent'), exam: t('profile.levelClass12') },
    4: { title: t('profile.levelBeast'), exam: t('profile.levelDropper') },
    5: { title: t('profile.levelLegend'), exam: t('profile.levelIitianDoctor') },
  }), [t]);
  const currentLevelCopy = localizedLevelCopy[level.rank as keyof typeof localizedLevelCopy] ?? localizedLevelCopy[1];

  const recentSessions = useMemo(() => getRecentSessions(sessions, 3), [sessions]);
  if (!user) return null;

  const showAlert = (title: string, message: string, isSignOut = false) => {
    if (isSignOut || Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message, isSignOut });
    } else if (isSignOut) {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: handleSignOut },
      ]);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSignOut = async () => {
    setAlertConfig(p => ({ ...p, visible: false }));
    try {
      await signOut();
    } catch (error: any) {
      showAlert(t('profile.signOutFailed'), error?.message ?? t('profile.tryAgain'));
    }
  };

  const openEditModal = () => {
    setEditName(user.fullName || '');
    setEditExam(user.targetExam || 'OTHER');
    setEditClass(user.classLevel || 'SELF_STUDY');
    setEditGoal(String(user.dailyGoalMinutes || 120));
    setEditAvatarUrl((user as any).avatarUrl || '');
    setAvatarError(null);
    setEditVisible(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('profile.permissionDenied'), t('profile.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        const sourceBytes = await getImageByteSize(asset);
        if (sourceBytes > MAX_AVATAR_SOURCE_BYTES) {
          setAvatarError(t('profile.avatarTooLarge', { size: formatFileSize(sourceBytes), max: formatFileSize(MAX_AVATAR_SOURCE_BYTES) }));
          return;
        }
        setAvatarError(null);
        setEditAvatarUrl(asset.uri);
      } catch (error: any) {
          setAvatarError(error?.message ?? t('profile.tryAgain'));
      }
    }
  };

  const handleSaveProfile = async () => {
    const mins = parseInt(editGoal);
    if (!editName.trim()) { showAlert(t('common.error'), t('profile.namePlaceholder')); return; }
    if (isNaN(mins) || mins < 15 || mins > 720) {
      showAlert(t('profile.invalidGoal'), t('profile.goalRange'));
      return;
    }
    setLoading(true);
    setAvatarError(null);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated.');

      let finalAvatarUrl = editAvatarUrl;

      const isNewLocalImage =
        editAvatarUrl &&
        editAvatarUrl !== (user as any).avatarUrl &&
        !editAvatarUrl.startsWith('http');

      if (isNewLocalImage) {
        const ext = 'jpeg';
        const mimeType = 'image/jpeg';
        const filePath = `${authUser.id}/${authUser.id}-${Date.now()}.${ext}`;
        const preparedAvatar = await prepareAvatarImage(editAvatarUrl);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, preparedAvatar.body, {
            contentType: mimeType,
            upsert: true,
            cacheControl: '3600',
          });

        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        finalAvatarUrl = urlData.publicUrl;
      }

      const { error: dbError } = await supabase
        .from('users')
        .update({
          name: editName.trim(),
          target_exam: editExam,
          class: editClass,
          daily_goal_minutes: mins,
          avatar_url: finalAvatarUrl,
        })
        .eq('id', authUser.id);

      if (dbError) throw new Error(`Save failed: ${dbError.message}`);

      // Update local context state immediately — use setUser but skip the DB re-write
      // by constructing the updated user object and setting it directly
      setUser({
        ...user,
        fullName: editName.trim(),
        targetExam: editExam as any,
        classLevel: editClass as any,
        dailyGoalMinutes: mins,
        avatarUrl: finalAvatarUrl,
      } as any);

      setEditVisible(false);
    } catch (error: any) {
      const message = error?.message || 'Unknown error occurred.';
      showAlert(t('profile.saveFailed'), message.includes('compressed photo')
        ? `${message} Maximum final size is ${formatFileSize(MAX_AVATAR_OUTPUT_BYTES)}.`
        : message);
      setAvatarError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Profile Header */}
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
            <View style={styles.badgesRow}>
              <View style={styles.examBadge}>
                <Text style={styles.examBadgeText}>
                  {user.targetExam || 'JEE'} • {t('profile.classValue', { value: user.classLevel || '12th' })}
                </Text>
              </View>
              {rankInfo && (
                <View style={[
                  styles.rankBadge,
                  { backgroundColor: rankInfo.color + '22', borderColor: rankInfo.color + '55' },
                ]}>
                  <MaterialIcons
                    name={
                      rankInfo.zone === 'Promotion' ? 'trending-up'
                      : rankInfo.zone === 'Safety' ? 'trending-flat'
                      : 'trending-down'
                    }
                    size={14}
                    color={rankInfo.color}
                  />
                  <Text style={[styles.rankBadgeText, { color: rankInfo.color }]}>
                    {t('profile.rankValue', { value: rankInfo.rank })} • {rankInfo.zone === 'Promotion' ? t('leaderboard.promotionZone') : rankInfo.zone === 'Safety' ? t('leaderboard.safetyZone') : t('leaderboard.demotionZone')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal}>
            <MaterialIcons name="edit" size={16} color={colors.background} />
            <Text style={styles.editProfileBtnText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Level + XP */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelHeaderCopy}>
              <Text style={[styles.levelTitle, { color: level.color }]}>
                {currentLevelCopy.title}
              </Text>
              <Text style={styles.levelExam}>{currentLevelCopy.exam}</Text>
            </View>
            <View style={styles.xpBadge}>
              <MaterialIcons name="bolt" size={16} color={colors.warning} />
              <Text style={styles.xpBadgeText}>{t('profile.weeklyXPValue', { value: user.xpTotal })}</Text>
            </View>
          </View>
          <XPBar xp={user.xpTotal} levelRank={user.levelRank} />
          <Text style={styles.xpNeeded}>
            {t('profile.xpToNextLevel', { value: progress.needed - progress.current })}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { icon: 'local-fire-department', color: colors.danger, val: user.streakCurrent, label: t('profile.currentStreak') },
            { icon: 'emoji-events', color: colors.warning, val: user.streakLongest, label: t('profile.bestStreak') },
            { icon: 'schedule', color: colors.accent, val: `${totalHours}${t('common.hoursShort')}`, label: t('profile.totalStudy') },
            { icon: 'check-circle', color: colors.success, val: doneChapters, label: t('profile.chaptersDone') },
          ].map(item => (
            <View key={item.label} style={styles.statItem}>
              <MaterialIcons name={item.icon as any} size={22} color={item.color} />
              <Text style={styles.statVal}>{item.val}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.notificationHeroCard}>
          <View style={styles.notificationHeroIcon}><MaterialIcons name="notifications-active" size={24} color={colors.primary} /></View>
          <View style={styles.notificationHeroInfo}>
            <Text style={styles.notificationHeroTitle}>{t('notifications.title')}</Text>
            <Text style={styles.notificationHeroText}>{t('notifications.inboxDescription')}</Text>
          </View>
          <TouchableOpacity style={styles.notificationHeroButton} onPress={() => router.push('/notifications' as Parameters<typeof router.push>[0])}>
            <Text style={styles.notificationHeroButtonText}>{t('notifications.openInbox')}</Text>
            <MaterialIcons name="chevron-right" size={18} color={colors.background} />
          </TouchableOpacity>
        </View>
        {adminRole ? (
          <TouchableOpacity style={styles.adminQuickLink} onPress={() => router.push('/admin/notifications' as Parameters<typeof router.push>[0])} activeOpacity={0.8}>
            <MaterialIcons name="campaign" size={20} color={colors.primary} />
            <View style={styles.notificationHeroInfo}><Text style={styles.adminQuickLinkTitle}>{t('notifications.adminTitle')}</Text><Text style={styles.notificationHeroText}>{t('notifications.adminDescription')}</Text></View>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        {/* Level Roadmap */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.levelRoadmap')}</Text>
          {LEVELS.map(l => {
            const roadmapCopy = localizedLevelCopy[l.rank as keyof typeof localizedLevelCopy] ?? localizedLevelCopy[1];
            return (
            <View
              key={l.rank}
              style={[styles.levelRow, level.rank >= l.rank ? styles.levelRowUnlocked : null]}
            >
              <View style={[styles.levelDot, {
                backgroundColor: level.rank >= l.rank ? l.color : colors.textTertiary,
              }]} />
              <View style={styles.levelRowInfo}>
                <Text style={[styles.levelRowTitle, {
                  color: level.rank >= l.rank ? l.color : colors.textTertiary,
                }]}>
                  {roadmapCopy.title}
                </Text>
                <Text style={styles.levelRowSub}>{roadmapCopy.exam} • {l.minXP}+ XP</Text>
              </View>
              {level.rank >= l.rank
                ? <MaterialIcons name="check-circle" size={18} color={l.color} />
                : null}
            </View>
            );
          })}
        </View>

        {/* Account Info + Sign Out */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.accountInfo')}</Text>

          <View style={styles.settingRow}>
            <MaterialIcons name="flag" size={20} color={colors.primary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.dailyGoal')}</Text>
              <Text style={styles.settingValue}>{t('profile.goalMinutes', { value: user.dailyGoalMinutes })}</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <MaterialIcons name="calendar-today" size={20} color={colors.textSecondary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.memberSince')}</Text>
              <Text style={styles.settingValue}>{joinDate}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/privacy-policy' as Parameters<typeof router.push>[0])}
            activeOpacity={0.7}
          >
            <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.privacyPolicy')}</Text>
              <Text style={styles.settingValue}>{t('profile.privacyDescription')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>



          {(user as any).myReferralCode ? (
            <View style={styles.settingRow}>
              <MaterialIcons name="card-giftcard" size={20} color={colors.primary} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t('profile.referralCode')}</Text>
                <Text style={styles.settingValue}>{String((user as any).myReferralCode).toUpperCase()}</Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => showAlert(t('profile.signOutTitle'), t('profile.signOutMessage'), true)}
            disabled={signingOut}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={20} color={colors.danger} />
            <View style={styles.settingInfo}>
              <Text style={styles.signOutLabel}>{signingOut ? t('profile.signingOut') : t('profile.signOut')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {recentSessions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profile.recentSessions')}</Text>
            {recentSessions.map(session => {
              const comebackBonus = Math.max(0, session.comebackBonus ?? 0);
              const baseXP = Math.max(0, session.xpEarned - comebackBonus);
              return (
              <View key={session.id} style={styles.sessionRow}>
                <MaterialIcons name={session.completed ? 'check-circle' : 'cancel'} size={17} color={session.completed ? colors.success : colors.danger} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{session.sessionDate}</Text>
                  <Text style={styles.settingValue}>{t('profile.goalMinutes', { value: session.durationActualMins })} {session.completed ? t('profile.completed') : t('profile.broken')}</Text>
                </View>
                <Text style={[styles.xpAmount, { color: session.completed ? colors.success : colors.danger }]}>
                  {session.completed
                    ? comebackBonus > 0
                      ? `+${baseXP} XP + ${comebackBonus} ${t('focus.comebackBonus').toLowerCase()}`
                      : `+${baseXP} XP`
                    : `-${session.xpDeducted} XP`}
                </Text>
              </View>
              );
            })}
          </View>
        ) : null}

        {/* Referral Rewards */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.referralRewards')}</Text>
          <View style={styles.xpRow}>
            <MaterialIcons name="group" size={16} color={colors.primary} />
            <Text style={styles.xpReason}>{t('profile.completedReferrals')}</Text>
            <Text style={[styles.xpAmount, { color: colors.primary }]}>{referralStats.completed}</Text>
          </View>
          <View style={styles.xpRow}>
            <MaterialIcons name="hourglass-empty" size={16} color={colors.warning} />
            <Text style={styles.xpReason}>{t('profile.pendingReferrals')}</Text>
            <Text style={[styles.xpAmount, { color: colors.warning }]}>{referralStats.pending}</Text>
          </View>
          <Text style={styles.referralStatus}>
            {referralStats.hasUnlockedReward
              ? t('profile.rewardUnlocked')
              : t('profile.referralsToUnlock', { value: Math.max(0, 5 - referralStats.completed) })}
          </Text>
          {referralStats.myCode ? (
            <Text style={styles.referralCode}>{t('profile.referralCodeValue', { value: referralStats.myCode.toUpperCase() })}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{t('profile.editProfile')}</Text>

              <TouchableOpacity style={styles.modalAvatarEdit} onPress={pickImage}>
                {editAvatarUrl ? (
                  <Image source={{ uri: editAvatarUrl }} style={styles.avatarImageSmall} />
                ) : (
                  <View style={[styles.avatarInitials, {
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: colors.surfaceVariant,
                  }]}>
                    <MaterialIcons name="person" size={30} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <MaterialIcons name="photo-camera" size={14} color="#FFF" />
                </View>
              </TouchableOpacity>
              {avatarError ? <Text style={styles.avatarError}>{avatarError}</Text> : null}

              <Text style={styles.inputLabel}>{t('profile.fullName')}</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('profile.namePlaceholder')}
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.inputLabel}>{t('profile.targetExam')}</Text>
              <View style={styles.chipRow}>
                {STUDY_GOALS.map(({ id: exam }) => (
                  <TouchableOpacity
                    key={exam}
                    style={[styles.chip, editExam === exam && styles.chipActive]}
                    onPress={() => setEditExam(exam)}
                  >
                    <Text style={[styles.chipText, editExam === exam && styles.chipTextActive]}>
                      {exam}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>{t('profile.classLabel')}</Text>
              <View style={styles.chipRow}>
                {PROFILE_LEARNER_TYPES.map(cls => (
                  <TouchableOpacity
                    key={cls}
                    style={[styles.chip, editClass === cls && styles.chipActive]}
                    onPress={() => setEditClass(cls)}
                  >
                    <Text style={[styles.chipText, editClass === cls && styles.chipTextActive]}>
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>{t('profile.dailyGoalMinutes')}</Text>
              <TextInput
                style={styles.input}
                value={editGoal}
                onChangeText={setEditGoal}
                keyboardType="number-pad"
                placeholder={t('profile.goalPlaceholder')}
                placeholderTextColor={colors.textTertiary}
              />

              <View style={styles.modalPreferenceCard}>
                <Text style={styles.modalPreferenceTitle}>{t('profile.editPreferences')}</Text>
                <View style={styles.modalSettingRow}>
                  <View style={styles.modalSettingInfo}><Text style={styles.modalSettingLabel}>{t('profile.theme')}</Text><Text style={styles.modalSettingValue}>{mode === 'dark' ? t('profile.darkMode') : t('profile.lightMode')}</Text></View>
                  <Switch value={mode === 'light'} onValueChange={() => { void toggleTheme(); }} trackColor={{ false: colors.surfaceVariant, true: colors.primary + '88' }} thumbColor={mode === 'light' ? colors.primary : colors.textTertiary} />
                </View>
                <View style={styles.modalSettingRow}>
                  <View style={styles.modalSettingInfo}><Text style={styles.modalSettingLabel}>{t('profile.language')}</Text><Text style={styles.modalSettingValue}>{t('settings.languageDescription')}</Text></View>
                  <View style={styles.languageOptions}>
                    {(['en', 'hi'] as const).map(option => (
                      <TouchableOpacity key={option} style={[styles.languageOption, language === option && styles.languageOptionActive]} onPress={() => { void setLanguage(option); }}>
                        <Text style={[styles.languageOptionText, language === option && styles.languageOptionTextActive]}>{option === 'en' ? t('profile.english') : t('profile.hindi')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.modalSettingRow}>
                  <View style={styles.modalSettingInfo}><Text style={styles.modalSettingLabel}>{t('profile.notificationsDevice')}</Text><Text style={styles.modalSettingValue}>{t('profile.notificationsDescription')}</Text></View>
                  <Switch value={notificationSettings.enabled} onValueChange={value => { void updateNotificationSettings({ enabled: value }); }} disabled={notificationBusy} trackColor={{ false: colors.surfaceVariant, true: colors.primary + '88' }} thumbColor={notificationSettings.enabled ? colors.primary : colors.textTertiary} />
                </View>
                {notificationSettings.enabled ? (
                  <View style={styles.modalReminderGroup}>
                    <View style={styles.modalSettingRow}><View style={styles.modalSettingInfo}><Text style={styles.modalSettingLabel}>{t('profile.studyReminder')}</Text></View><Switch value={notificationSettings.studyReminder} onValueChange={value => { void updateNotificationSettings({ studyReminder: value }); }} disabled={notificationBusy} trackColor={{ false: colors.surfaceVariant, true: colors.primary + '88' }} thumbColor={notificationSettings.studyReminder ? colors.primary : colors.textTertiary} /></View>
                    <View style={styles.modalSettingRow}><View style={styles.modalSettingInfo}><Text style={styles.modalSettingLabel}>{t('profile.todoReminder')}</Text></View><Switch value={notificationSettings.todoReminder} onValueChange={value => { void updateNotificationSettings({ todoReminder: value }); }} disabled={notificationBusy} trackColor={{ false: colors.surfaceVariant, true: colors.primary + '88' }} thumbColor={notificationSettings.todoReminder ? colors.primary : colors.textTertiary} /></View>
                    <View style={styles.modalSettingRow}><View style={styles.modalSettingInfo}><Text style={styles.modalSettingLabel}>{t('profile.streakReminder')}</Text></View><Switch value={notificationSettings.streakReminder} onValueChange={value => { void updateNotificationSettings({ streakReminder: value }); }} disabled={notificationBusy} trackColor={{ false: colors.surfaceVariant, true: colors.primary + '88' }} thumbColor={notificationSettings.streakReminder ? colors.primary : colors.textTertiary} /></View>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveProfile}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={colors.background} />
                    : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Sign-out loading overlay */}
      <Modal visible={signingOut} transparent animationType="fade">
        <View style={styles.signOutOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.signOutOverlayText}>{t('profile.signingOut')}</Text>
        </View>
      </Modal>

      {/* Confirmation and alert modal */}
      <Modal
        visible={alertConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertConfig(p => ({ ...p, visible: false }))}
      >
        <View style={styles.alertOverlay}>
          <View style={[styles.alertBox, alertConfig.isSignOut && styles.signOutAlertBox]}>
            <View style={[styles.alertIcon, alertConfig.isSignOut && styles.signOutAlertIcon]}>
              <MaterialIcons
                name={alertConfig.isSignOut ? 'logout' : 'info-outline'}
                size={24}
                color={alertConfig.isSignOut ? colors.danger : colors.primary}
              />
            </View>
            {alertConfig.isSignOut ? <Text style={styles.alertEyebrow}>{t('profile.accountAction')}</Text> : null}
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMsg}>{alertConfig.message}</Text>
            {alertConfig.isSignOut ? (
              <Text style={styles.alertHint}>{t('profile.signOutHint')}</Text>
            ) : null}
            <View style={styles.alertActions}>
              {alertConfig.isSignOut ? (
                <>
                  <TouchableOpacity
                    style={[styles.alertBtn, styles.alertBtnSecondary]}
                    onPress={() => setAlertConfig(p => ({ ...p, visible: false }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.alertButtonTextSecondary}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.alertBtn, styles.alertBtnDanger]}
                    onPress={handleSignOut}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.alertButtonText}>{t('profile.signOut')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.alertBtn, { flex: 1 }]}
                  onPress={() => setAlertConfig(p => ({ ...p, visible: false }))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.alertButtonText}>{t('common.ok')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  profileHeader: { alignItems: 'center', marginBottom: Spacing.xl, paddingTop: Spacing.md },
  avatarContainer: { position: 'relative', marginBottom: Spacing.sm },
  avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: colors.primary },
  avatarInitials: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, includeFontPadding: false },
  profileInfo: { alignItems: 'center', marginBottom: Spacing.md },
  profileName: { maxWidth: '100%', fontSize: FontSize.xxl, lineHeight: 34, fontWeight: FontWeight.bold, color: colors.textPrimary, textAlign: 'center', flexShrink: 1 },
  profileSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  examBadge: { backgroundColor: colors.primary + '22', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.primary + '55' },
  examBadgeText: { fontSize: FontSize.xs, color: colors.primary, fontWeight: FontWeight.semiBold },
  rankBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  rankBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full },
  editProfileBtnText: { color: colors.background, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  levelCard: { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  levelHeaderCopy: { flex: 1, minWidth: 0 },
  levelTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, includeFontPadding: false },
  levelExam: { fontSize: FontSize.sm, color: colors.textSecondary },
  xpBadge: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '22', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  xpBadgeText: { fontSize: FontSize.sm, lineHeight: 18, color: colors.warning, fontWeight: FontWeight.semiBold },
  xpNeeded: { fontSize: FontSize.xs, color: colors.textTertiary, marginTop: 6 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary, includeFontPadding: false },
  statLabel: { fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: colors.textTertiary, letterSpacing: 1.2, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  notificationHeroCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.primary + '55', backgroundColor: colors.primary + '12' },
  notificationHeroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  notificationHeroInfo: { flex: 1, minWidth: 0 },
  notificationHeroTitle: { color: colors.textPrimary, fontSize: FontSize.base, lineHeight: 20, fontWeight: FontWeight.bold, flexShrink: 1 },
  notificationHeroText: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 17, marginTop: 2, flexShrink: 1 },
  notificationHeroButton: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 7 },
  notificationHeroButtonText: { color: colors.background, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  adminQuickLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.primary + '55', backgroundColor: colors.surface },
  adminQuickLinkTitle: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: 0.4 },
  levelRowUnlocked: { opacity: 1 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelRowInfo: { flex: 1, minWidth: 0 },
  levelRowTitle: { fontSize: FontSize.base, lineHeight: 20, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  levelRowSub: { fontSize: FontSize.xs, lineHeight: 17, color: colors.textTertiary, flexShrink: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  languageOptions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  languageOption: { borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 7, paddingVertical: 5 },
  languageOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  languageOptionText: { color: colors.textSecondary, fontSize: 10, fontWeight: FontWeight.bold },
  languageOptionTextActive: { color: colors.background },
  settingInfo: { flex: 1, minWidth: 0 },
  notificationOptions: { marginLeft: Spacing.md, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: Spacing.sm },
  settingLabel: { fontSize: FontSize.base, lineHeight: 20, color: colors.textPrimary, flexShrink: 1 },
  settingValue: { fontSize: FontSize.sm, lineHeight: 18, color: colors.textSecondary, marginTop: 2, flexShrink: 1 },
  signOutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: Spacing.sm, marginTop: 4 },
  signOutLabel: { fontSize: FontSize.base, color: colors.danger, fontWeight: FontWeight.semiBold },
  xpRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  xpReason: { flex: 1, minWidth: 0, fontSize: FontSize.sm, lineHeight: 18, color: colors.textSecondary, textTransform: 'capitalize', flexShrink: 1 },
  xpAmount: { maxWidth: '45%', flexShrink: 1, fontSize: FontSize.sm, lineHeight: 18, fontWeight: FontWeight.semiBold, textAlign: 'right' },
  referralStatus: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 6 },
  referralCode: { fontSize: FontSize.xs, color: colors.primary, fontWeight: FontWeight.bold, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl, marginTop: 'auto', borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: FontSize.xl, lineHeight: 28, fontWeight: FontWeight.bold, color: colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center', flexShrink: 1 },
  modalPreferenceCard: { marginTop: Spacing.md, padding: Spacing.sm, paddingRight: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  modalPreferenceTitle: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: 2 },
  modalSettingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingRight: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalSettingInfo: { flex: 1, minWidth: 0 },
  modalSettingLabel: { color: colors.textPrimary, fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  modalSettingValue: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 17, marginTop: 2, flexShrink: 1 },
  modalReminderGroup: { marginLeft: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  modalAvatarEdit: { alignSelf: 'center', marginBottom: 6, position: 'relative' },
  avatarError: { fontSize: FontSize.xs, color: colors.danger, textAlign: 'center', marginBottom: Spacing.sm },
  avatarImageSmall: { width: 64, height: 64, borderRadius: 32 },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: colors.primary, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  inputLabel: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.bold, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: colors.surfaceVariant, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12, color: colors.textPrimary, fontSize: FontSize.md, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { flexGrow: 1, flexBasis: '28%', minWidth: 82, backgroundColor: colors.surfaceVariant, paddingHorizontal: 8, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, textAlign: 'center', flexShrink: 1 },
  chipTextActive: { color: colors.primary, fontWeight: FontWeight.bold },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, backgroundColor: colors.surfaceVariant, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold },
  saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  alertOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  alertBox: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  signOutAlertBox: { borderColor: colors.danger + '66' },
  alertIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  signOutAlertIcon: { backgroundColor: colors.danger + '18' },
  alertEyebrow: { fontSize: FontSize.xs, color: colors.danger, fontWeight: FontWeight.bold, letterSpacing: 1.2, marginBottom: 6 },
  alertTitle: { fontSize: FontSize.xl, lineHeight: 28, fontWeight: FontWeight.bold, color: colors.textPrimary, marginBottom: 8, textAlign: 'center', flexShrink: 1 },
  alertMsg: { fontSize: FontSize.base, color: colors.textSecondary, marginBottom: 8, textAlign: 'center', lineHeight: 21, flexShrink: 1 },
  alertHint: { fontSize: FontSize.sm, lineHeight: 19, color: colors.textTertiary, textAlign: 'center', marginBottom: Spacing.lg, flexShrink: 1 },
  alertActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: Spacing.sm },
  alertBtn: { flex: 1, minHeight: 46, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  alertBtnSecondary: { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border },
  alertBtnDanger: { backgroundColor: colors.danger },
  alertButtonTextSecondary: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  alertButtonText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  signOutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  signOutOverlayText: {
    color: colors.textSecondary,
    fontSize: FontSize.base,
    lineHeight: 20,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
});

