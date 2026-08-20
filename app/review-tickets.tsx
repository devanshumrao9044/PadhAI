import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  closeStudyGroupTicket,
  getOwnerStudyGroupReports,
  getOwnerStudyGroupTickets,
  isPadhaiOwner,
  reviewStudyGroupReport,
  type StudyGroupReport,
  type StudyGroupTicket,
} from '@/features/study-groups/services/studyGroups';

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

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const isOwner = await isPadhaiOwner(user.id);
      setOwner(isOwner);
      setOwnerChecked(true);
      if (!isOwner) {
        setTickets([]);
        setReports([]);
        return;
      }
      const [ticketRows, reportRows] = await Promise.all([
        getOwnerStudyGroupTickets(),
        getOwnerStudyGroupReports(),
      ]);
      setTickets(ticketRows);
      setReports(reportRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your support history.');
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const updateReport = (report: StudyGroupReport) => {
    if (!owner) return;
    Alert.alert('Review report', 'Choose a resolution status.', [
      { text: t('support.reviewed'), onPress: () => { void reviewStudyGroupReport(report.id, 'reviewed').then(() => load(true)); } },
      { text: t('support.actioned'), onPress: () => { void reviewStudyGroupReport(report.id, 'actioned', 'Reviewed by the PadhAI owner.').then(() => load(true)); } },
      { text: t('support.dismissed'), style: 'destructive', onPress: () => { void reviewStudyGroupReport(report.id, 'dismissed').then(() => load(true)); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const closeTicket = (ticket: StudyGroupTicket) => {
    if (!owner) return;
    Alert.alert(t('support.closed'), ticket.subject, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('support.closed'), onPress: () => { void closeStudyGroupTicket(ticket.id).then(() => load(true)); } },
    ]);
  };

  const renderTicket = ({ item }: { item: StudyGroupTicket }) => (
    <View style={styles.card}><View style={styles.cardHeader}><View style={styles.cardIcon}><MaterialIcons name="support-agent" size={20} color={colors.primary} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={2}>{item.subject}</Text><Text style={styles.cardMeta}>{item.category.replaceAll('_', ' ')} · {new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={styles.status}>{statusLabel(item.status, t)}</Text></View><Text style={styles.details} numberOfLines={4}>{item.details}</Text>{item.resolution ? <Text style={styles.resolution}>{item.resolution}</Text> : null}{owner && item.status !== 'closed' ? <Pressable onPress={() => closeTicket(item)} style={styles.ownerAction}><Text style={styles.ownerActionText}>{t('support.closed')}</Text></Pressable> : null}</View>
  );

  const renderReport = ({ item }: { item: StudyGroupReport }) => (
    <Pressable onPress={() => updateReport(item)} style={({ pressed }) => [styles.card, pressed && owner && styles.pressed]}><View style={styles.cardHeader}><View style={[styles.cardIcon, { backgroundColor: colors.warning + '18' }]}><MaterialIcons name="flag" size={20} color={colors.warning} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.reasonCode.replaceAll('_', ' ')}</Text><Text style={styles.cardMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={styles.status}>{statusLabel(item.status, t)}</Text></View><Text style={styles.details}>{item.details || 'No additional details provided.'}</Text>{item.resolution ? <Text style={styles.resolution}>{item.resolution}</Text> : null}{owner ? <Text style={styles.ownerHint}>Tap to review</Text> : null}</Pressable>
  );

  if (ownerChecked && !owner) {
    return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><View style={styles.empty}><Text style={styles.emptyText}>{t('support.ownerOnly')}</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.headerButton}><MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>{t('support.reviewTicketsReports')}</Text><Text style={styles.subtitle}>{owner ? 'Owner view' : `${tickets.length + reports.length} items`}</Text></View><Pressable onPress={() => router.push('/raise-ticket' as never)} style={styles.addButton}><MaterialIcons name="add" size={22} color={colors.background} /></Pressable></View>
      <View style={styles.tabs}><Pressable onPress={() => setTab('tickets')} style={[styles.tab, tab === 'tickets' && styles.tabActive]}><Text style={[styles.tabText, tab === 'tickets' && styles.tabTextActive]}>{t('support.myTickets')} ({tickets.length})</Text></Pressable><Pressable onPress={() => setTab('reports')} style={[styles.tab, tab === 'reports' && styles.tabActive]}><Text style={[styles.tabText, tab === 'reports' && styles.tabTextActive]}>{t('support.myReports')} ({reports.length})</Text></Pressable></View>
      {owner ? <Pressable onPress={() => router.push('/admin/study-groups' as never)} style={styles.ownerLink}><MaterialIcons name="admin-panel-settings" size={18} color={colors.primary} /><Text style={styles.ownerLinkText}>Manage all Study Groups</Text><MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} /></Pressable> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!ownerChecked ? <Text style={styles.emptyText}>{t('common.loading')}</Text> : !owner ? <View style={styles.empty}><Text style={styles.emptyText}>{t('support.ownerOnly')}</Text></View> : null}
      {owner ? (tab === 'tickets' ? (
        <FlatList<StudyGroupTicket>
          data={tickets}
          keyExtractor={item => item.id}
          renderItem={renderTicket}
          contentContainerStyle={tickets.length ? styles.list : styles.empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('support.noTickets')}</Text>}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList<StudyGroupReport>
          data={reports}
          keyExtractor={item => item.id}
          renderItem={renderReport}
          contentContainerStyle={reports.length ? styles.list : styles.empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('support.noReports')}</Text>}
          showsVerticalScrollIndicator={false}
        />
      )) : null}
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
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: Spacing.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, textAlign: 'center' },
  tabTextActive: { color: colors.primary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 50 },
  empty: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  emptyText: { color: colors.textSecondary, textAlign: 'center', fontSize: FontSize.md, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  cardMeta: { color: colors.textTertiary, fontSize: FontSize.xs, marginTop: 3, textTransform: 'capitalize' },
  status: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  details: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  resolution: { color: colors.success, fontSize: FontSize.sm, lineHeight: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.sm },
  ownerAction: { alignSelf: 'flex-start', borderRadius: Radius.sm, backgroundColor: colors.primary + '16', paddingHorizontal: 10, paddingVertical: 8 },
  ownerActionText: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  ownerHint: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  error: { color: colors.danger, padding: Spacing.md, lineHeight: 20 },
  ownerLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderColor: colors.primary + '55', borderRadius: Radius.md, backgroundColor: colors.primary + '10' },
  ownerLinkText: { flex: 1, color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  pressed: { opacity: 0.8 },
});
