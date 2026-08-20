import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getOwnerStudyGroups, isPadhaiOwner, type StudyGroup } from '@/features/study-groups/services/studyGroups';

export default function OwnerStudyGroupsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setRefreshing(true);
    try {
      const owner = await isPadhaiOwner(user.id);
      setAllowed(owner);
      if (owner) setGroups(await getOwnerStudyGroups());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('support.noOwnerAccess'));
    } finally {
      setRefreshing(false);
    }
  }, [t, user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!allowed && !error) return <SafeAreaView style={styles.container}><Text style={styles.centerText}>{t('common.loading')}</Text></SafeAreaView>;
  if (!allowed) return <SafeAreaView style={styles.container}><Text style={styles.centerText}>{error || t('support.noOwnerAccess')}</Text></SafeAreaView>;

  const renderItem = ({ item }: { item: StudyGroup }) => <Pressable onPress={() => router.push(`/study-groups/${item.id}` as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardHeader}><View style={styles.icon}><MaterialIcons name="groups" size={23} color={colors.primary} /></View><View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.targetExam} · {item.visibility} · code {item.joinCode}</Text></View><MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} /></View><Text style={styles.description} numberOfLines={2}>{item.description || t('groups.noRules')}</Text><View style={styles.stats}><Text style={styles.stat}>{item.dailyGoalMinutes}{t('common.minutesShort')} goal</Text><Text style={styles.stat}>{item.maxMembers} {t('groups.members')} max</Text></View></Pressable>;

  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.headerButton}><MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Study Groups moderation</Text><Text style={styles.subtitle}>Owner access · {groups.length} groups</Text></View><Pressable onPress={() => router.push('/review-tickets' as never)} style={styles.headerButton}><MaterialIcons name="flag" size={21} color={colors.primary} /></Pressable></View><FlatList data={groups} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={groups.length ? styles.list : styles.empty} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />} ListEmptyComponent={<Text style={styles.centerText}>No groups found.</Text>} /></SafeAreaView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  empty: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  meta: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 3, textTransform: 'capitalize' },
  description: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19 },
  stats: { flexDirection: 'row', gap: Spacing.md },
  stat: { color: colors.textTertiary, fontSize: FontSize.xs },
  centerText: { flex: 1, color: colors.textSecondary, textAlign: 'center', textAlignVertical: 'center', padding: Spacing.xl, lineHeight: 22 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
