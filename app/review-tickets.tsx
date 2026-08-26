import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  getMyStudyGroupReports,
  getMyStudyGroupTickets,
  getOwnerStudyGroupReports,
  getOwnerStudyGroupTickets,
  getStudyGroupNames,
  isPadhaiOwner,
  respondToStudyGroupTicket,
  reviewStudyGroupReport,
  subscribeToStudyGroupTickets,
  type StudyGroupReport,
  type StudyGroupTicket,
  type StudyGroupTicketStatus,
} from '@/features/study-groups/services/studyGroups';
import { getSafeErrorMessage } from '@/features/core/services/safeError';
import { createSingleActionLock } from '@/features/core/services/singleAction';
import { filterVisibleSupportHistory, hideSupportReport, hideSupportTicket, readSupportHistory, writeSupportHistory, type LocalSupportHistory } from '@/features/study-groups/services/supportCache';

export default function ReviewTicketsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<'tickets' | 'reports'>('tickets');
  const [tickets, setTickets] = useState<StudyGroupTicket[]>([]);
  const [reports, setReports] = useState<StudyGroupReport[]>([]);
  const [owner, setOwner] = useState(false);
  const [ownerChecked, setOwnerChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null);
  const [, setLocalHistory] = useState<LocalSupportHistory>({ tickets: [], reports: [], hiddenTicketIds: [], hiddenReportIds: [] });
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const ticketMutationRef = useRef(createSingleActionLock());
  const reportReviewRef = useRef(createSingleActionLock());

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setRefreshing(true);
    setError('');
    const cachedHistory = await readSupportHistory(user.id);
    const visibleCachedHistory = filterVisibleSupportHistory(cachedHistory);
    setLocalHistory(cachedHistory);
    setTickets(visibleCachedHistory.tickets);
    setReports(visibleCachedHistory.reports);
    try {
      const isOwner = await isPadhaiOwner(user.id);
      setOwner(isOwner);
      setOwnerChecked(true);
      const [ticketRows, reportRows] = isOwner
        ? await Promise.all([getOwnerStudyGroupTickets(), getOwnerStudyGroupReports()])
        : await Promise.all([getMyStudyGroupTickets(user.id), getMyStudyGroupReports(user.id)]);
      const nextHistory: LocalSupportHistory = { ...cachedHistory, tickets: ticketRows, reports: reportRows };
      const names = isOwner ? await getStudyGroupNames(reportRows.map(report => report.groupId ?? '')) : {};
      setGroupNames(names);
      const visibleNextHistory = filterVisibleSupportHistory(nextHistory);
      await writeSupportHistory(user.id, nextHistory);
      setLocalHistory(nextHistory);
      setTickets(visibleNextHistory.tickets);
      setReports(visibleNextHistory.reports);
    } catch (loadError) {
      setError(getSafeErrorMessage(loadError, {
        fallback: 'Could not load your support history.',
        network: 'Showing the last saved support history. Check your connection to refresh.',
        permission: 'You do not have permission to view this support history.',
      }));
      setOwnerChecked(true);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!user?.id || !ownerChecked) return;
    return subscribeToStudyGroupTickets(user.id, owner, () => { void load(); });
  }, [load, owner, ownerChecked, user?.id]);

  const deleteTicketLocally = (ticketId: string) => {
    if (!user?.id) return;
    Alert.alert(t('support.deleteLocalTitle'), t('support.deleteLocalMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('support.deleteLocal'), style: 'destructive', onPress: () => {
        void hideSupportTicket(user.id, ticketId).then(next => {
          setLocalHistory(next);
          setTickets(filterVisibleSupportHistory(next).tickets);
        });
      } },
    ]);
  };

  const deleteReportLocally = (reportId: string) => {
    if (!user?.id) return;
    Alert.alert(t('support.deleteLocalTitle'), t('support.deleteLocalMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('support.deleteLocal'), style: 'destructive', onPress: () => {
        void hideSupportReport(user.id, reportId).then(next => {
          setLocalHistory(next);
          setReports(filterVisibleSupportHistory(next).reports);
        });
      } },
    ]);
  };

  const updateReport = (report: StudyGroupReport) => {
    if (!owner || !reportReviewRef.current.acquire()) return;
    const resolve = (status: 'reviewed' | 'actioned' | 'dismissed', resolution?: string) => {
      void reviewStudyGroupReport(report.id, status, resolution)
        .then(() => load(true))
        .finally(() => reportReviewRef.current.release());
    };
    Alert.alert('Review report', 'Choose a resolution status.', [
      { text: t('support.reviewed'), onPress: () => resolve('reviewed') },
      { text: t('support.actioned'), onPress: () => resolve('actioned', 'Reviewed by the PadhAI owner.') },
      { text: t('support.dismissed'), style: 'destructive', onPress: () => resolve('dismissed') },
      { text: t('common.cancel'), style: 'cancel', onPress: () => reportReviewRef.current.release() },
    ], { cancelable: true, onDismiss: () => reportReviewRef.current.release() });
  };

  const sendTicketResponse = async (ticket: StudyGroupTicket, status: Exclude<StudyGroupTicketStatus, 'open'>, responseOverride?: string) => {
    const response = (responseOverride ?? drafts[ticket.id] ?? '').trim();
    if (response.length < 3) {
      setError(t('support.ticketResponseTooShort'));
      return;
    }
    if (!ticketMutationRef.current.acquire()) return;
    setSavingTicketId(ticket.id);
    setError('');
    try {
      await respondToStudyGroupTicket({ ticketId: ticket.id, status, resolution: response });
      setDrafts(current => ({ ...current, [ticket.id]: '' }));
      await load(true);
      Alert.alert(t('support.ticketResponseSent'), status === 'closed' ? t('support.ticketIssueSolved') : t('support.ticketResponseSent'));
    } catch (responseError) {
      setError(getSafeErrorMessage(responseError, {
        fallback: 'Could not send the ticket response.',
        network: 'Check your connection and try again.',
        permission: 'Only the PadhAI owner can respond to tickets.',
      }));
    } finally {
      setSavingTicketId(null);
      ticketMutationRef.current.release();
    }
  };

  const closeTicket = (ticket: StudyGroupTicket) => {
    if (!owner) return;
    Alert.alert(t('support.ticketCloseConfirmTitle'), t('support.ticketCloseConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('support.ticketCloseAndNotify'), onPress: () => {
        const current = drafts[ticket.id]?.trim();
        void sendTicketResponse(ticket, 'closed', current && current.length >= 3 ? current : t('support.ticketIssueSolved'));
      } },
    ]);
  };

  const renderTicket = ({ item }: { item: StudyGroupTicket }) => {
    const expanded = expandedTicketId === item.id;
    const isSaving = savingTicketId === item.id;
    const isClosed = item.status === 'closed';
    return (
      <View style={styles.card}>
        <Pressable onPress={() => setExpandedTicketId(expanded ? null : item.id)} style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}>
          <View style={styles.cardIcon}><MaterialIcons name="support-agent" size={20} color={colors.primary} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.subject}</Text>
            <Text style={styles.cardMeta}>{item.category.replaceAll('_', ' ')} · {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.statusColumn}><Text style={[styles.status, isClosed && styles.statusClosed]}>{statusLabel(item.status, t)}</Text><MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textTertiary} /></View><Pressable onPress={() => deleteTicketLocally(item.id)} style={styles.deleteButton} accessibilityLabel={t('support.deleteLocal')}><MaterialIcons name="delete-outline" size={20} color={colors.danger} /></Pressable>
        </Pressable>
        {expanded ? (
          <View style={styles.expandedBody}>
            <Text style={styles.details}>{item.details}</Text>
            <View style={styles.timelineRow}><View style={styles.timelineDot} /><Text style={styles.timelineText}>{new Date(item.updatedAt).toLocaleString()}</Text></View>
            {item.resolution ? <View style={styles.resolutionBox}><MaterialIcons name={isClosed || item.status === 'resolved' ? 'check-circle' : 'reply'} size={18} color={colors.success} /><View style={styles.resolutionCopy}><Text style={styles.resolutionLabel}>{isClosed ? t('support.ticketIssueSolved') : t('support.ticketResponse')}</Text><Text style={styles.resolution}>{item.resolution}</Text></View></View> : <Text style={styles.noResponse}>{t('support.ticketNoResponse')}</Text>}
            {owner && !isClosed ? (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Text style={styles.responseLabel}>{t('support.ticketWriteResponse')}</Text>
                <TextInput value={drafts[item.id] ?? ''} onChangeText={value => setDrafts(current => ({ ...current, [item.id]: value }))} placeholder={t('support.ticketResponsePlaceholder')} placeholderTextColor={colors.textTertiary} style={styles.responseInput} multiline maxLength={1000} textAlignVertical="top" />
                <Text style={styles.characterCount}>{(drafts[item.id] ?? '').length}/1000</Text>
                <View style={styles.actionRow}>
                  <Pressable disabled={isSaving} onPress={() => { void sendTicketResponse(item, 'in_progress'); }} style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.pressed, isSaving && styles.disabled]}><Text style={styles.secondaryActionText}>{t('support.ticketSaveProgress')}</Text></Pressable>
                  <Pressable disabled={isSaving} onPress={() => { void sendTicketResponse(item, 'resolved'); }} style={({ pressed }) => [styles.actionButton, styles.resolveAction, pressed && styles.pressed, isSaving && styles.disabled]}><Text style={styles.resolveActionText}>{t('support.ticketResolve')}</Text></Pressable>
                </View>
                <Pressable disabled={isSaving} onPress={() => closeTicket(item)} style={({ pressed }) => [styles.closeAction, pressed && styles.pressed, isSaving && styles.disabled]}><MaterialIcons name="done-all" size={17} color={colors.danger} /><Text style={styles.closeActionText}>{t('support.ticketCloseAndNotify')}</Text></Pressable>
              </KeyboardAvoidingView>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const reportGroupLabel = (report: StudyGroupReport) => report.groupId ? (groupNames[report.groupId] || t('support.groupUnavailable')) : t('support.groupUnavailable');
  const showReportGroup = (report: StudyGroupReport) => Alert.alert(t('support.reportGroupContext'), reportGroupLabel(report));

  const renderReport = ({ item }: { item: StudyGroupReport }) => (
    <View style={styles.card}><Pressable onPress={() => updateReport(item)} style={({ pressed }) => [styles.cardHeader, pressed && owner && styles.pressed]}><View style={[styles.cardIcon, { backgroundColor: colors.warning + '18' }]}><MaterialIcons name="flag" size={20} color={colors.warning} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.reasonCode.replaceAll('_', ' ')}</Text><Text style={styles.cardMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text></View><View style={styles.statusColumn}><Text style={styles.status}>{statusLabel(item.status, t)}</Text><MaterialIcons name={owner ? 'chevron-right' : 'flag'} size={18} color={colors.textTertiary} /></View><Pressable onPress={() => deleteReportLocally(item.id)} style={styles.deleteButton} accessibilityLabel={t('support.deleteLocal')}><MaterialIcons name="delete-outline" size={20} color={colors.danger} /></Pressable></Pressable><Pressable onPress={() => showReportGroup(item)} style={styles.groupContextButton}><MaterialIcons name="groups" size={17} color={colors.primary} /><Text style={styles.groupContextText} numberOfLines={1}>{reportGroupLabel(item)}</Text><MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} /></Pressable><Text style={styles.details} numberOfLines={4}>{item.details || 'No additional details provided.'}</Text>{item.resolution ? <Text style={styles.resolution}>{item.resolution}</Text> : null}{owner ? <Text style={styles.ownerHint}>{t('support.ownerReplyHint')}</Text> : null}</View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.headerButton}><MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>{owner ? t('support.ownerTicketInbox') : t('support.reviewMyTickets')}</Text><Text style={styles.subtitle}>{owner ? t('support.ticketOwnerView') : t('support.reviewMyTicketsHint')}</Text></View><Pressable onPress={() => router.push('/raise-ticket' as never)} style={styles.addButton}><MaterialIcons name="add" size={22} color={colors.background} /></Pressable></View>
      <View style={styles.tabs}><Pressable onPress={() => setTab('tickets')} style={[styles.tab, tab === 'tickets' && styles.tabActive]}><Text style={[styles.tabText, tab === 'tickets' && styles.tabTextActive]}>{t('support.myTickets')} ({tickets.length})</Text></Pressable><Pressable onPress={() => setTab('reports')} style={[styles.tab, tab === 'reports' && styles.tabActive]}><Text style={[styles.tabText, tab === 'reports' && styles.tabTextActive]}>{t('support.myReports')} ({reports.length})</Text></Pressable></View>
      {!owner ? <View style={styles.userIntro}><MaterialIcons name="verified-user" size={17} color={colors.primary} /><Text style={styles.userIntroText}>{t('support.reviewMyTicketsHint')}</Text></View> : null}
      {owner ? <Pressable onPress={() => router.push('/admin/study-groups' as never)} style={styles.ownerLink}><MaterialIcons name="admin-panel-settings" size={18} color={colors.primary} /><Text style={styles.ownerLinkText}>{t('support.manageStudyGroups')}</Text><MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} /></Pressable> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!ownerChecked ? <Text style={styles.emptyText}>{t('common.loading')}</Text> : tab === 'tickets' ? (
        <FlatList<StudyGroupTicket> data={tickets} keyExtractor={item => item.id} renderItem={renderTicket} contentContainerStyle={tickets.length ? styles.list : styles.empty} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />} ListEmptyComponent={<View style={styles.emptyState}><MaterialIcons name="support-agent" size={42} color={colors.primary} /><Text style={styles.emptyTitle}>{t('support.noTickets')}</Text>{!owner ? <Pressable onPress={() => router.push('/raise-ticket' as never)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('support.raiseTicket')}</Text></Pressable> : null}</View>} showsVerticalScrollIndicator={false} />
      ) : (
        <FlatList<StudyGroupReport> data={reports} keyExtractor={item => item.id} renderItem={renderReport} contentContainerStyle={reports.length ? styles.list : styles.empty} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />} ListEmptyComponent={<View style={styles.emptyState}><MaterialIcons name="flag" size={42} color={colors.warning} /><Text style={styles.emptyTitle}>{t('support.noReports')}</Text></View>} showsVerticalScrollIndicator={false} />
      )}
    </SafeAreaView>
  );
}

function statusLabel(status: string, t: (key: any) => string): string {
  const map: Record<string, string> = { open: 'open', in_progress: 'inProgress', resolved: 'resolved', closed: 'closed', pending: 'pending', reviewed: 'reviewed', actioned: 'actioned', dismissed: 'dismissed' };
  return t(`support.${map[status] ?? 'pending'}` as any);
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 17, marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: Spacing.md },
  userIntro: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: Spacing.md, marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '30' },
  userIntroText: { flex: 1, color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 17 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, textAlign: 'center' },
  tabTextActive: { color: colors.primary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 50 },
  empty: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  emptyText: { color: colors.textSecondary, textAlign: 'center', fontSize: FontSize.md, lineHeight: 22 },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { color: colors.textSecondary, textAlign: 'center', fontSize: FontSize.md, lineHeight: 22 },
  emptyButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 11, marginTop: Spacing.sm },
  emptyButtonText: { color: colors.background, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  cardMeta: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 3, textTransform: 'capitalize' },
  statusColumn: { alignItems: 'flex-end', gap: 2, maxWidth: '32%' },
  status: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'right', textTransform: 'capitalize' },
  statusClosed: { color: colors.success },
  deleteButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, backgroundColor: colors.danger + '10' },
  groupContextButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: colors.primary + '10' },
  groupContextText: { flex: 1, color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  expandedBody: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: Spacing.md, paddingTop: Spacing.md },
  details: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md },
  timelineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  timelineText: { color: colors.textTertiary, fontSize: FontSize.xs },
  resolutionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.md, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: colors.success + '12', borderWidth: 1, borderColor: colors.success + '35' },
  resolutionCopy: { flex: 1, minWidth: 0 },
  resolutionLabel: { color: colors.success, fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 3 },
  resolution: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  noResponse: { color: colors.textTertiary, fontSize: FontSize.sm, fontStyle: 'italic', marginTop: Spacing.md },
  responseLabel: { color: colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  responseInput: { minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.background, color: colors.textPrimary, padding: Spacing.sm, fontSize: FontSize.sm, lineHeight: 20 },
  characterCount: { color: colors.textTertiary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionButton: { flex: 1, minHeight: 43, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  secondaryAction: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  secondaryActionText: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'center' },
  resolveAction: { backgroundColor: colors.success },
  resolveActionText: { color: colors.background, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'center' },
  closeAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.danger + '55', backgroundColor: colors.danger + '10', marginTop: Spacing.sm },
  closeActionText: { color: colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  ownerHint: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, marginTop: Spacing.sm },
  ownerLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderColor: colors.primary + '55', borderRadius: Radius.md, backgroundColor: colors.primary + '10' },
  ownerLinkText: { flex: 1, color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  error: { color: colors.danger, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, lineHeight: 20 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
