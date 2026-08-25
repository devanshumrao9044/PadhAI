import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  deleteStudyGroupPermanently,
  restoreStudyGroup,
  suspendStudyGroup,
  canManageStudyGroupMember,
  createStudyGroupInvite,
  formatStudyDuration,
  getMyStudyGroupMemberships,
  getPendingStudyGroupMembers,
  getStudyGroup,
  getStudyGroupInviteToken,
  getStudyGroupMembers,
  isPadhaiOwner,
  joinStudyGroup,
  leaveStudyGroup,
  removeStudyGroupMember,
  reviewStudyGroupMember,
  updateStudyGroupDetails,
  updateStudyGroupIcon,
  updateStudyGroupMemberRole,
  STUDY_GROUP_ICON_OPTIONS,
  submitStudyGroupReport,
  subscribeToStudyGroup,
  DEFAULT_STUDY_GROUP_PERMISSIONS,
  type StudyGroup,
  type StudyGroupMember,
  type StudyGroupPendingMember,
  type StudyGroupMembership,
  type StudyGroupPermissions,
  type StudyGroupPermissionKey,
  type StudyGroupReportReason,
} from '@/features/study-groups/services/studyGroups';
import StudyGroupReportSheet from '@/components/study-groups/StudyGroupReportSheet';
import { getSafeErrorMessage } from '@/features/core/services/safeError';

function iconName(iconKey: string): string {
  return STUDY_GROUP_ICON_OPTIONS.find(option => option.key === iconKey)?.icon ?? 'menu-book';
}

const SUSPEND_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 720, label: '12 hours' },
  { minutes: 1440, label: '1 day' },
  { minutes: 10080, label: '7 days' },
];

const PERMISSION_ITEMS: { key: StudyGroupPermissionKey; labelKey: string }[] = [
  { key: 'manageJoinRequests', labelKey: 'permissionManageRequests' },
  { key: 'removeMembers', labelKey: 'permissionRemoveMembers' },
  { key: 'manageInvites', labelKey: 'permissionManageInvites' },
  { key: 'editGroup', labelKey: 'permissionEditGroup' },
  { key: 'assignCoAdmin', labelKey: 'permissionAssignCoAdmin' },
  { key: 'editCoAdminPermissions', labelKey: 'permissionEditCoAdminPermissions' },
  { key: 'demoteCoAdmin', labelKey: 'permissionDemoteCoAdmin' },
];

function formatLiveDuration(startedAt: string | null): string {
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function StudyGroupDetailScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<StudyGroupMember[]>([]);
  const [pending, setPending] = useState<StudyGroupPendingMember[]>([]);
  const [membership, setMembership] = useState<StudyGroupMembership | null>(null);
  const [ownerAccess, setOwnerAccess] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [manageTarget, setManageTarget] = useState<StudyGroupMember | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<StudyGroupPermissions>(DEFAULT_STUDY_GROUP_PERMISSIONS);
  const [managing, setManaging] = useState(false);
  const [joining, setJoining] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [showSuspensionPicker, setShowSuspensionPicker] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editTargetExam, setEditTargetExam] = useState('');
  const [editDailyGoal, setEditDailyGoal] = useState('120');
  const [editMaxMembers, setEditMaxMembers] = useState('12');
  const [savingGroup, setSavingGroup] = useState(false);
  const thankYouOpacity = useRef(new Animated.Value(0)).current;
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setLiveNow] = useState(Date.now());

  const load = useCallback(async (refresh = false) => {
    if (!groupId || !user?.id) return;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const [groupData, myMemberships, appOwner] = await Promise.all([
        getStudyGroup(groupId),
        getMyStudyGroupMemberships(user.id),
        isPadhaiOwner(user.id),
      ]);
      setGroup(groupData);
      const myMembership = myMemberships.find(entry => entry.groupId === groupId) ?? null;
      setMembership(myMembership);
      setOwnerAccess(appOwner);
      const canSeeMembers = appOwner || myMembership?.status === 'approved';
      if (canSeeMembers) {
        const [memberRows, pendingRows, currentInvite] = await Promise.all([
          getStudyGroupMembers(groupId),
          appOwner || myMembership?.role === 'owner' || Boolean(myMembership?.permissions.manageJoinRequests) ? getPendingStudyGroupMembers(groupId) : Promise.resolve([]),
          appOwner || myMembership?.role === 'owner' || Boolean(myMembership?.permissions.manageInvites) ? getStudyGroupInviteToken(groupId) : Promise.resolve(null),
        ]);
        setMembers(memberRows);
        setPending(pendingRows);
        setInviteToken(currentInvite);
      }
      if (!groupData) setError('This Study Group is no longer available.');
    } catch (loadError) {
      setError(getSafeErrorMessage(loadError, {
        fallback: 'Could not load this Study Group. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to view this Study Group.',
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    void load();
    if (!groupId) return;
    const unsubscribe = subscribeToStudyGroup(groupId, () => { void load(true); });
    const timer = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [groupId, load]);

  const isAdmin = ownerAccess || membership?.role === 'owner' || membership?.role === 'admin';
  const canEditGroup = ownerAccess || membership?.role === 'owner' || Boolean(membership?.permissions.editGroup);
  const canManageInvites = ownerAccess || membership?.role === 'owner' || Boolean(membership?.permissions.manageInvites);
  const canManageJoinRequests = ownerAccess || membership?.role === 'owner' || Boolean(membership?.permissions.manageJoinRequests);
  const isApprovedMember = ownerAccess || membership?.status === 'approved';
  const studyingMembers = members.filter(member => member.presenceStatus === 'studying');
  const groupTotal = members.reduce((sum, member) => sum + member.todayMinutes, 0);
  const isSuspended = Boolean(group?.suspendedUntil && Date.parse(group.suspendedUntil) > Date.now());

  const showNotice = (message: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNoticeMessage(message);
    setThankYou(true);
    thankYouOpacity.setValue(0);
    Animated.timing(thankYouOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    noticeTimerRef.current = setTimeout(() => {
      setThankYou(false);
      setNoticeMessage('');
      noticeTimerRef.current = null;
    }, 3200);
  };

  const submitReport = async (reasonCode: StudyGroupReportReason, details: string) => {
    if (!groupId) return;
    await submitStudyGroupReport({ groupId, reasonCode, details });
    showNotice(t('groups.reportSubmitted'));
  };

  const canManageTargetAction = (action: 'demote' | 'remove', permissionKey: 'demoteCoAdmin' | 'removeMembers') => {
    if (!manageTarget) return false;
    const actorRole = ownerAccess ? 'owner' : membership?.role ?? 'member';
    const hasPermission = ownerAccess || membership?.role === 'owner' || Boolean(membership?.permissions[permissionKey]);
    return canManageStudyGroupMember(actorRole, manageTarget.role, action, hasPermission);
  };

  const openMemberManager = (member: StudyGroupMember) => {
    if (member.userId === user?.id || member.role === 'owner') return;
    const actorRole = ownerAccess ? 'owner' : membership?.role ?? 'member';
    const action = member.role === 'admin' ? 'editPermissions' : 'promote';
    const permissionKey = member.role === 'admin' ? 'editCoAdminPermissions' : 'assignCoAdmin';
    const hasPermission = ownerAccess || membership?.role === 'owner' || Boolean(membership?.permissions[permissionKey]);
    if (!canManageStudyGroupMember(actorRole, member.role, action, hasPermission)) return;
    setPermissionDraft(member.role === 'admin' ? member.permissions : { ...DEFAULT_STUDY_GROUP_PERMISSIONS });
    setManageTarget(member);
  };

  const saveMemberPermissions = async () => {
    if (!manageTarget) return;
    setManaging(true);
    try {
      await updateStudyGroupMemberRole({ membershipId: manageTarget.membershipId, role: 'admin', permissions: permissionDraft });
      setManageTarget(null);
      showNotice(t('groups.permissionsUpdated'));
      await load(true);
    } catch (manageError) {
      setError(getSafeErrorMessage(manageError, {
        fallback: 'Could not update member permissions. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to manage this member.',
      }));
    } finally {
      setManaging(false);
    }
  };

  const demoteMember = async () => {
    if (!manageTarget) return;
    setManaging(true);
    try {
      await updateStudyGroupMemberRole({ membershipId: manageTarget.membershipId, role: 'member', permissions: DEFAULT_STUDY_GROUP_PERMISSIONS });
      setManageTarget(null);
      showNotice(t('groups.permissionsUpdated'));
      await load(true);
    } catch (manageError) {
      setError(getSafeErrorMessage(manageError, {
        fallback: 'Could not demote the co-admin. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to demote this co-admin.',
      }));
    } finally {
      setManaging(false);
    }
  };

  const removeMember = async () => {
    if (!manageTarget) return;
    setManaging(true);
    try {
      await removeStudyGroupMember(manageTarget.membershipId);
      setManageTarget(null);
      showNotice(t('groups.memberRemoved'));
      await load(true);
    } catch (manageError) {
      setError(getSafeErrorMessage(manageError, {
        fallback: 'Could not remove the member. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to remove this member.',
      }));
    } finally {
      setManaging(false);
    }
  };

  const joinPublicGroup = async () => {
    if (!groupId) return;
    setJoining(true);
    try {
      await joinStudyGroup(groupId);
      await load(true);
    } catch (joinError) {
      setError(getSafeErrorMessage(joinError, {
        fallback: 'Could not join this group. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to join this group.',
        rateLimit: 'Too many requests. Please wait and try again.',
      }));
    } finally {
      setJoining(false);
    }
  };

  const openGroupEditor = () => {
    if (!group || !canEditGroup) return;
    setEditName(group.name);
    setEditDescription(group.description);
    setEditRules(group.rules);
    setEditTargetExam(group.targetExam);
    setEditDailyGoal(String(group.dailyGoalMinutes));
    setEditMaxMembers(String(group.maxMembers));
    setShowGroupEditor(true);
  };

  const saveGroupDetails = async () => {
    if (!group) return;
    setSavingGroup(true);
    setError('');
    try {
      await updateStudyGroupDetails({
        groupId: group.id,
        name: editName,
        description: editDescription,
        rules: editRules,
        targetExam: editTargetExam,
        dailyGoalMinutes: Number(editDailyGoal),
        maxMembers: Number(editMaxMembers),
      });
      setShowGroupEditor(false);
      showNotice(t('groups.permissionsUpdated'));
      await load(true);
    } catch (editError) {
      setError(getSafeErrorMessage(editError, {
        fallback: 'Could not update the group. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to edit this group.',
      }));
    } finally {
      setSavingGroup(false);
    }
  };

  const chooseIcon = async (iconKey: string) => {
    if (!groupId) return;
    try {
      await updateStudyGroupIcon(groupId, iconKey);
      setShowIconPicker(false);
      await load(true);
    } catch (iconError) {
      setError(getSafeErrorMessage(iconError, {
        fallback: 'Could not update your icon. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to update your icon.',
      }));
    }
  };

  const handleSuspend = async (durationMinutes: number) => {
    if (!group || lifecycleBusy) return;
    setLifecycleBusy(true);
    setError('');
    try {
      await suspendStudyGroup(group.id, durationMinutes);
      setShowSuspensionPicker(false);
      showNotice(t('groups.suspendedStatus'));
      await load(true);
    } catch (lifecycleError) {
      setError(getSafeErrorMessage(lifecycleError, {
        fallback: 'Could not suspend this Study Group. Please try again.',
        network: t('common.networkError'),
        permission: t('common.permissionError'),
      }));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!group || lifecycleBusy) return;
    setLifecycleBusy(true);
    setError('');
    try {
      await restoreStudyGroup(group.id);
      showNotice(t('groups.restoreGroup'));
      await load(true);
    } catch (lifecycleError) {
      setError(getSafeErrorMessage(lifecycleError, {
        fallback: 'Could not restore this Study Group. Please try again.',
        network: t('common.networkError'),
        permission: t('common.permissionError'),
      }));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handlePermanentDelete = () => {
    if (!group || lifecycleBusy) return;
    Alert.alert(t('groups.deleteGroupConfirm'), t('groups.deleteGroupConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('groups.deleteGroupPermanently'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLifecycleBusy(true);
            setError('');
            try {
              await deleteStudyGroupPermanently(group.id);
              router.replace('/study-groups' as never);
            } catch (lifecycleError) {
              setError(getSafeErrorMessage(lifecycleError, {
                fallback: 'Could not delete this Study Group. Please try again.',
                network: t('common.networkError'),
                permission: t('common.permissionError'),
              }));
            } finally {
              setLifecycleBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const getInviteLink = () => inviteToken ? `PadhAI://study-groups/join?token=${encodeURIComponent(inviteToken)}` : '';

  const copyInvite = async () => {
    const inviteLink = getInviteLink();
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    showNotice(t('groups.linkCopied'));
  };

  const shareInvite = async () => {
    if (!group || !inviteToken) return;
    await Share.share({ message: `${group.name} — join my PadhAI Study Group: ${getInviteLink()}` });
  };

  const regenerateInvite = async () => {
    if (!groupId) return;
    try {
      const nextToken = await createStudyGroupInvite(groupId);
      setInviteToken(nextToken);
      showNotice(t('groups.linkRegenerated'));
    } catch (inviteError) {
      setError(getSafeErrorMessage(inviteError, {
        fallback: 'Could not create an invite. Please try again.',
        network: 'Check your connection and try again.',
        permission: 'You do not have permission to create invites.',
        rateLimit: 'Too many requests. Please wait and try again.',
      }));
    }
  };

  const handleLeave = () => {
    if (!groupId || membership?.role === 'owner') {
      setError(t('groups.leaveOwner'));
      return;
    }
    Alert.alert(t('groups.leaveGroup'), t('groups.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('groups.leaveGroup'), style: 'destructive', onPress: async () => {
        try {
          await leaveStudyGroup(groupId);
          router.replace('/study-groups' as never);
        } catch (leaveError) {
          setError(getSafeErrorMessage(leaveError, {
            fallback: 'Could not leave the group. Please try again.',
            network: 'Check your connection and try again.',
            permission: 'You do not have permission to leave this group.',
          }));
        }
      } },
    ]);
  };

  const renderMember = (member: StudyGroupMember) => {
    const label = member.userId === user?.id ? 'You' : member.name;
    const liveDuration = member.presenceStatus === 'studying' || member.presenceStatus === 'paused' ? formatLiveDuration(member.presenceStartedAt) : formatStudyDuration(member.todayMinutes);
    const actorRole = ownerAccess ? 'owner' : membership?.role ?? 'member';
    const memberAction = member.role === 'admin' ? 'editPermissions' : 'promote';
    const memberPermission = member.role === 'admin' ? 'editCoAdminPermissions' : 'assignCoAdmin';
    const canOpenManager = member.userId !== user?.id && member.role !== 'owner' && canManageStudyGroupMember(actorRole, member.role, memberAction, ownerAccess || membership?.role === 'owner' || Boolean(membership?.permissions[memberPermission]));
    return (
      <View key={member.membershipId} style={styles.memberCard}>
        <View style={[styles.memberIcon, member.presenceStatus === 'studying' && styles.memberIconLive]}>
          <MaterialIcons name={iconName(member.iconKey) as any} size={24} color={member.presenceStatus === 'studying' ? colors.primary : colors.textSecondary} />
        </View>
        <View style={styles.memberCopy}>
          <Text style={styles.memberName} numberOfLines={1}>{label}</Text>
          <Text style={[styles.memberStatus, member.presenceStatus === 'studying' && styles.liveText]}>{member.presenceStatus === 'studying' ? t('groups.studying') : member.presenceStatus === 'paused' ? t('groups.paused') : t('groups.offline')}</Text>
        </View>
        <View style={styles.memberTimeBlock}>
          <Text style={[styles.memberTime, member.presenceStatus === 'studying' && styles.liveText]}>{liveDuration}</Text>
          <Text style={styles.memberToday}>{member.presenceStatus === 'studying' ? 'live' : t('groups.today')}</Text>
        </View>
        {canOpenManager ? <Pressable onLongPress={() => openMemberManager(member)} delayLongPress={420} style={styles.memberManageHint} accessibilityLabel={t('groups.memberActions')}><MaterialIcons name="more-horiz" size={20} color={colors.textTertiary} /></Pressable> : null}
      </View>
    );
  };

  if (loading && !group) return <SafeAreaView style={styles.container}><Text style={styles.centerText}>{t('common.loading')}</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title} numberOfLines={1}>{group?.name ?? t('groups.title')}</Text><Text style={styles.subtitle}>{group?.targetExam ?? ''}</Text></View>
        <Pressable onPress={() => setReportOpen(true)} style={styles.headerButton} accessibilityLabel={t('groups.reportGroup')}><MaterialIcons name="flag" size={20} color={colors.textSecondary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}>
        {group ? <>
          <View style={styles.heroCard}>
            <View style={styles.groupIconLarge}><MaterialIcons name={iconName(group.iconKey) as any} size={32} color={colors.primary} /></View>
            <View style={styles.heroCopy}><Text style={styles.groupName}>{group.name}</Text><Text style={styles.groupMeta}>{group.visibility === 'private' ? t('groups.privateGroup') : t('groups.publicGroup')} · {group.targetExam}</Text></View>
            {ownerAccess ? <View style={styles.ownerBadge}><MaterialIcons name="verified-user" size={14} color={colors.primary} /><Text style={styles.ownerBadgeText}>Owner</Text></View> : null}
          </View>
          {group.description ? <Text style={styles.description}>{group.description}</Text> : null}
          {isSuspended ? <View style={styles.suspendedCard}><MaterialIcons name="pause-circle-filled" size={20} color={colors.warning} /><View style={styles.suspendedCopy}><Text style={styles.suspendedTitle}>{t('groups.suspendedStatus')}</Text><Text style={styles.suspendedText}>{t('groups.suspendGroupHint')}</Text><Text style={styles.suspendedText}>{t('groups.suspendedUntil', { value: new Date(group.suspendedUntil as string).toLocaleString() })}</Text></View></View> : null}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}><Text style={styles.summaryValue}>{studyingMembers.length}</Text><Text style={styles.summaryLabel}>{t('groups.studyingNow')}</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryValue}>{formatStudyDuration(groupTotal)}</Text><Text style={styles.summaryLabel}>{t('groups.groupTotal')}</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryValue}>{group.dailyGoalMinutes}{t('common.minutesShort')}</Text><Text style={styles.summaryLabel}>{t('groups.dailyGoal')}</Text></View>
          </View>
          <View style={styles.rulesCard}><Text style={styles.sectionTitle}>{t('groups.rules')}</Text><Text style={styles.body}>{group.rules || t('groups.noRules')}</Text></View>

          {isApprovedMember ? <>
            <Pressable onPress={() => router.push(`/focus?studyGroupId=${encodeURIComponent(group.id)}` as never)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialIcons name="timer" size={19} color={colors.background} /><Text style={styles.primaryText}>{t('groups.startGroupSession')}</Text></Pressable>
            <Pressable onPress={() => setShowIconPicker(true)} style={styles.outlineButton}><MaterialIcons name="palette" size={17} color={colors.primary} /><Text style={styles.outlineText}>{t('groups.changeIcon')}</Text></Pressable>
            {members.length ? <View style={styles.section}><Text style={styles.sectionTitle}>{t('groups.members')} · {members.length}</Text>{members.map(renderMember)}</View> : <Text style={styles.emptyText}>{t('groups.noMembers')}</Text>}
          </> : membership?.status === 'pending' ? <View style={styles.pendingCard}><MaterialIcons name="hourglass-top" size={22} color={colors.warning} /><Text style={styles.pendingText}>{t('groups.pendingApproval')}</Text></View> : <View style={styles.pendingCard}><MaterialIcons name="public" size={22} color={colors.primary} /><Text style={styles.pendingText}>{t('groups.requestToJoin')}</Text><Pressable onPress={() => { void joinPublicGroup(); }} disabled={joining} style={styles.smallApprove}><Text style={styles.smallApproveText}>{joining ? '…' : t('groups.joinGroup')}</Text></Pressable></View>}

          {isAdmin ? <View style={styles.adminCard}>
            {canManageJoinRequests ? <><View style={styles.adminHeader}><Text style={styles.sectionTitle}>{t('groups.manageRequests')}</Text><Text style={styles.adminCount}>{pending.length}</Text></View>{pending.length === 0 ? <Text style={styles.body}>{t('groups.noMembers')}</Text> : pending.map(request => <View key={request.membershipId} style={styles.requestRow}><View style={styles.requestCopy}><Text style={styles.requestName}>{request.name}</Text><Text style={styles.memberStatus}>Pending request</Text></View><Pressable onPress={() => { void reviewStudyGroupMember(request.membershipId, 'approved').then(() => load(true)); }} style={styles.smallApprove}><Text style={styles.smallApproveText}>{t('groups.approve')}</Text></Pressable><Pressable onPress={() => { void reviewStudyGroupMember(request.membershipId, 'rejected').then(() => load(true)); }} style={styles.smallReject}><Text style={styles.smallRejectText}>{t('groups.reject')}</Text></Pressable></View>)}</> : null}
            {canEditGroup ? <Pressable onPress={openGroupEditor} style={styles.outlineButton}><MaterialIcons name="edit" size={17} color={colors.primary} /><Text style={styles.outlineText}>{t('groups.permissionEditGroup')}</Text></Pressable> : null}
            {canManageInvites ? <View style={styles.adminActions}>{inviteToken ? <><Pressable onPress={() => { void copyInvite(); }} style={styles.outlineButton}><MaterialIcons name="content-copy" size={17} color={colors.primary} /><Text style={styles.outlineText}>{t('groups.copyLink')}</Text></Pressable><Pressable onPress={() => { void shareInvite(); }} style={styles.outlineButton}><MaterialIcons name="share" size={17} color={colors.primary} /><Text style={styles.outlineText}>{t('groups.shareInvite')}</Text></Pressable></> : null}<Pressable onPress={() => { void regenerateInvite(); }} style={styles.outlineButton}><MaterialIcons name="refresh" size={17} color={colors.primary} /><Text style={styles.outlineText}>{t('groups.inviteLink')}</Text></Pressable></View> : null}
            {membership?.role === 'owner' || ownerAccess ? <View style={styles.lifecycleCard}>
              <Text style={styles.lifecycleTitle}>{t('groups.suspendGroup')}</Text>
              <Text style={styles.lifecycleHint}>{t('groups.suspendGroupHint')}</Text>
              {isSuspended ? <Pressable onPress={() => { void handleRestore(); }} disabled={lifecycleBusy} style={[styles.outlineButton, lifecycleBusy && styles.disabled]}><MaterialIcons name="play-circle" size={17} color={colors.success} /><Text style={[styles.outlineText, { color: colors.success }]}>{lifecycleBusy ? t('groups.suspending') : t('groups.restoreGroup')}</Text></Pressable> : <Pressable onPress={() => setShowSuspensionPicker(true)} disabled={lifecycleBusy} style={[styles.outlineButton, lifecycleBusy && styles.disabled]}><MaterialIcons name="pause-circle" size={17} color={colors.warning} /><Text style={[styles.outlineText, { color: colors.warning }]}>{lifecycleBusy ? t('groups.suspending') : t('groups.suspendGroup')}</Text></Pressable>}
              <Pressable onPress={handlePermanentDelete} disabled={lifecycleBusy} style={[styles.archiveButton, lifecycleBusy && styles.disabled]}><Text style={styles.archiveText}>{t('groups.deleteGroupPermanently')}</Text></Pressable>
            </View> : null}
          </View> : null}
          {isApprovedMember && membership?.role !== 'owner' ? <Pressable onPress={handleLeave} style={styles.leaveButton}><Text style={styles.leaveText}>{t('groups.leaveGroup')}</Text></Pressable> : null}
          {isApprovedMember ? <Pressable onPress={() => router.push('/raise-ticket' as never)} style={styles.supportLink}><MaterialIcons name="support-agent" size={18} color={colors.primary} /><Text style={styles.outlineText}>{t('support.reportProblem')}</Text></Pressable> : null}
        </> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Modal visible={showIconPicker} transparent animationType="slide" onRequestClose={() => setShowIconPicker(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{t('groups.chooseIcon')}</Text><Text style={styles.modalSubtitle}>{t('groups.iconHint')}</Text><View style={styles.iconGrid}>{STUDY_GROUP_ICON_OPTIONS.map(option => <Pressable key={option.key} onPress={() => { void chooseIcon(option.key); }} style={styles.reasonRow}><View style={styles.iconPickerChoice}><MaterialIcons name={option.icon as any} size={25} color={colors.primary} /></View><Text style={styles.reasonText}>{option.key}</Text></Pressable>)}</View><Pressable onPress={() => setShowIconPicker(false)} style={styles.cancelButton}><Text style={styles.cancelText}>{t('common.close')}</Text></Pressable></View></View>
      </Modal>
      <Modal visible={showSuspensionPicker} transparent animationType="slide" onRequestClose={() => setShowSuspensionPicker(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{t('groups.suspendDuration')}</Text><Text style={styles.modalSubtitle}>{t('groups.suspendGroupHint')}</Text>{SUSPEND_OPTIONS.map(option => <Pressable key={option.minutes} onPress={() => { void handleSuspend(option.minutes); }} disabled={lifecycleBusy} style={[styles.durationOption, lifecycleBusy && styles.disabled]}><MaterialIcons name="schedule" size={18} color={colors.primary} /><Text style={styles.durationOptionText}>{option.label}</Text></Pressable>)}<Pressable onPress={() => setShowSuspensionPicker(false)} style={styles.cancelButton}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable></View></View>
      </Modal>
      <Modal visible={showGroupEditor} transparent animationType="slide" onRequestClose={() => setShowGroupEditor(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{t('groups.permissionEditGroup')}</Text><TextInput value={editName} onChangeText={setEditName} placeholder={t('groups.groupName')} placeholderTextColor={colors.textTertiary} style={styles.editorInput} maxLength={60} /><TextInput value={editDescription} onChangeText={setEditDescription} placeholder={t('groups.description')} placeholderTextColor={colors.textTertiary} style={[styles.editorInput, styles.multiline]} maxLength={240} multiline textAlignVertical="top" /><TextInput value={editRules} onChangeText={setEditRules} placeholder={t('groups.rules')} placeholderTextColor={colors.textTertiary} style={[styles.editorInput, styles.multiline]} maxLength={2000} multiline textAlignVertical="top" /><TextInput value={editTargetExam} onChangeText={setEditTargetExam} placeholder={t('groups.targetExam')} placeholderTextColor={colors.textTertiary} style={styles.editorInput} maxLength={40} /><View style={styles.editorRow}><TextInput value={editDailyGoal} onChangeText={setEditDailyGoal} placeholder={t('groups.dailyGoal')} placeholderTextColor={colors.textTertiary} style={[styles.editorInput, styles.editorHalf]} keyboardType="number-pad" /><TextInput value={editMaxMembers} onChangeText={setEditMaxMembers} placeholder={t('groups.maxMembers')} placeholderTextColor={colors.textTertiary} style={[styles.editorInput, styles.editorHalf]} keyboardType="number-pad" /></View><View style={styles.modalActions}><Pressable onPress={() => setShowGroupEditor(false)} style={styles.cancelButton}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable><Pressable onPress={() => { void saveGroupDetails(); }} disabled={savingGroup} style={[styles.modalSubmit, savingGroup && styles.disabled]}><Text style={styles.primaryText}>{savingGroup ? t('common.loading') : t('groups.savePermissions')}</Text></Pressable></View></View></View>
      </Modal>
      <StudyGroupReportSheet visible={reportOpen} groupName={group?.name ?? ''} onClose={() => setReportOpen(false)} onSubmitted={submitReport} />
      <Modal visible={Boolean(manageTarget)} transparent animationType="slide" onRequestClose={() => setManageTarget(null)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{t('groups.permissionsTitle')}</Text><Text style={styles.modalSubtitle}>{manageTarget?.name}</Text><Text style={styles.body}>{t('groups.permissionsHint')}</Text>{PERMISSION_ITEMS.map(item => <View key={item.key} style={styles.permissionRow}><Text style={styles.reasonText}>{t(`groups.${item.labelKey}` as any)}</Text><Switch value={permissionDraft[item.key]} onValueChange={value => setPermissionDraft(current => ({ ...current, [item.key]: value }))} trackColor={{ false: colors.border, true: colors.primary + '88' }} thumbColor={permissionDraft[item.key] ? colors.primary : colors.textTertiary} /></View>)}<View style={styles.modalActions}><Pressable onPress={() => setManageTarget(null)} style={styles.cancelButton}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable><Pressable onPress={() => { void saveMemberPermissions(); }} disabled={managing} style={[styles.modalSubmit, managing && styles.disabled]}><Text style={styles.primaryText}>{managing ? t('common.loading') : manageTarget?.role === 'admin' ? t('groups.savePermissions') : t('groups.makeCoAdmin')}</Text></Pressable></View>{manageTarget?.role === 'admin' && canManageTargetAction('demote', 'demoteCoAdmin') ? <Pressable onPress={() => { void demoteMember(); }} disabled={managing} style={styles.demoteButton}><Text style={styles.demoteText}>{t('groups.demoteCoAdmin')}</Text></Pressable> : null}{canManageTargetAction('remove', 'removeMembers') ? <Pressable onPress={() => { void removeMember(); }} disabled={managing} style={styles.removeButton}><Text style={styles.removeText}>{t('groups.removeMember')}</Text></Pressable> : null}</View></View>
      </Modal>
      {thankYou ? <Animated.View style={[styles.thankYou, { opacity: thankYouOpacity }]}><MaterialIcons name="check-circle" size={27} color={colors.success} /><Text style={styles.thankYouText}>{noticeMessage}</Text></Animated.View> : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerText: { flex: 1, color: colors.textSecondary, textAlign: 'center', textAlignVertical: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  content: { padding: Spacing.md, paddingBottom: 50, gap: Spacing.sm },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md },
  groupIconLarge: { width: 58, height: 58, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18' },
  heroCopy: { flex: 1, minWidth: 0 },
  groupName: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  groupMeta: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: colors.primary + '16', borderRadius: Radius.full },
  ownerBadgeText: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  description: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 22, paddingHorizontal: 2 },
  summaryRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: Spacing.md },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  summaryValue: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  summaryLabel: { color: colors.textSecondary, fontSize: FontSize.xs, textAlign: 'center' },
  rulesCard: { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, gap: Spacing.sm },
  section: { gap: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  body: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  primaryButton: { minHeight: 50, borderRadius: Radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: Spacing.sm },
  primaryText: { color: colors.background, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  memberCard: { minHeight: 72, backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  memberIconLive: { backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  memberStatus: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 3 },
  liveText: { color: colors.primary },
  memberTimeBlock: { alignItems: 'flex-end' },
  memberTime: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  memberToday: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 2 },
  memberManageHint: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pendingCard: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', backgroundColor: colors.warning + '16', borderWidth: 1, borderColor: colors.warning + '55', borderRadius: Radius.md, padding: Spacing.md },
  pendingText: { color: colors.textPrimary, flex: 1, lineHeight: 20 },
  adminCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  adminHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminCount: { color: colors.primary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.border },
  requestCopy: { flex: 1 },
  requestName: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  smallApprove: { backgroundColor: colors.success + '20', paddingHorizontal: 8, paddingVertical: 7, borderRadius: Radius.sm },
  smallApproveText: { color: colors.success, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  smallReject: { backgroundColor: colors.danger + '16', paddingHorizontal: 8, paddingVertical: 7, borderRadius: Radius.sm },
  smallRejectText: { color: colors.danger, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  adminActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  outlineButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.primary + '66', borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 9 },
  outlineText: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  archiveButton: { paddingVertical: 10, alignItems: 'center' },
  archiveText: { color: colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  lifecycleCard: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: Spacing.sm },
  lifecycleTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  lifecycleHint: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 18 },
  suspendedCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: colors.warning + '16', borderWidth: 1, borderColor: colors.warning + '55', borderRadius: Radius.lg, padding: Spacing.md },
  suspendedCopy: { flex: 1, gap: 3 },
  suspendedTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  suspendedText: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 17 },
  durationOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  durationOptionText: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  leaveButton: { alignItems: 'center', paddingVertical: Spacing.md },
  leaveText: { color: colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  supportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  emptyText: { color: colors.textSecondary, textAlign: 'center', padding: Spacing.md },
  error: { color: colors.danger, lineHeight: 20, marginTop: Spacing.sm },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '92%' },
  modalTitle: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalSubtitle: { color: colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  modalLabel: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  permissionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  demoteButton: { paddingVertical: 11, alignItems: 'center' },
  demoteText: { color: colors.warning, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  removeButton: { paddingVertical: 11, alignItems: 'center' },
  removeText: { color: colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconPickerChoice: { width: 42, height: 42, borderRadius: Radius.md, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  reasonText: { color: colors.textSecondary, flex: 1, lineHeight: 19 },
  detailsInput: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.background, color: colors.textPrimary, minHeight: 84, padding: Spacing.sm, textAlignVertical: 'top' },
  editorInput: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.background, color: colors.textPrimary, minHeight: 48, paddingHorizontal: Spacing.sm, paddingVertical: 10 },
  editorRow: { flexDirection: 'row', gap: Spacing.sm },
  editorHalf: { flex: 1 },
  multiline: { textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: FontWeight.semiBold },
  modalSubmit: { flex: 1, minHeight: 48, borderRadius: Radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  thankYou: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: Spacing.xl, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.success + '66', borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, elevation: 8 },
  thankYouText: { color: colors.textPrimary, flex: 1, lineHeight: 20 },
});
