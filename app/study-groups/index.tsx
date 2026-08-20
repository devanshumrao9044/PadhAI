import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import {
  getMyStudyGroups,
  searchPublicStudyGroups,
  STUDY_GROUP_ICON_OPTIONS,
  type StudyGroup,
  type StudyGroupMembership,
} from '@/features/study-groups/services/studyGroups';

type MyGroupEntry = { group: StudyGroup; membership: StudyGroupMembership };
type ListItem = { kind: 'mine' | 'search'; entry: MyGroupEntry | StudyGroup };

function iconName(iconKey: string): string {
  return STUDY_GROUP_ICON_OPTIONS.find(option => option.key === iconKey)?.icon ?? 'menu-book';
}

export default function StudyGroupsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [myGroups, setMyGroups] = useState<MyGroupEntry[]>([]);
  const [searchResults, setSearchResults] = useState<StudyGroup[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const loadGroups = useCallback(async (force = false) => {
    if (!user?.id) return;
    setError('');
    if (!force) {
      const cached = await readUserCache<MyGroupEntry[]>(user.id, 'studyGroups');
      if (cached?.data) {
        setMyGroups(cached.data);
        setLoading(false);
      }
    }
    try {
      const fresh = await getMyStudyGroups(user.id);
      setMyGroups(fresh);
      await writeUserCache(user.id, 'studyGroups', fresh);
    } catch (loadError) {
      if (!myGroups.length) setError(loadError instanceof Error ? loadError.message : 'Could not load groups.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myGroups.length, user?.id]);

  useFocusEffect(useCallback(() => {
    void loadGroups();
  }, [loadGroups]));

  const handleSearch = async () => {
    setSearching(true);
    setError('');
    try {
      setSearchResults(await searchPublicStudyGroups(query));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Could not search groups.');
    } finally {
      setSearching(false);
    }
  };

  const items: ListItem[] = query.trim()
    ? searchResults.map(entry => ({ kind: 'search' as const, entry }))
    : myGroups.map(entry => ({ kind: 'mine' as const, entry }));

  const renderItem = ({ item }: { item: ListItem }) => {
    const isMine = item.kind === 'mine';
    const group = isMine ? (item.entry as MyGroupEntry).group : item.entry as StudyGroup;
    const membership = isMine ? (item.entry as MyGroupEntry).membership : null;
    const statusText = membership?.status === 'pending' ? t('groups.pendingApproval') : group.visibility === 'private' ? t('groups.privateGroup') : t('groups.publicGroup');
    return (
      <Pressable onPress={() => router.push(`/study-groups/${group.id}` as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.cardTop}>
          <View style={styles.groupIcon}><MaterialIcons name={iconName(group.iconKey) as any} size={25} color={colors.primary} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
            <Text style={styles.groupMeta} numberOfLines={1}>{group.targetExam} · {statusText}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
        </View>
        {group.description ? <Text style={styles.description} numberOfLines={2}>{group.description}</Text> : null}
        <View style={styles.statsRow}>
          <Text style={styles.stat}><MaterialIcons name="flag" size={14} color={colors.textSecondary} /> {group.dailyGoalMinutes}{t('common.minutesShort')}</Text>
          <Text style={styles.stat}><MaterialIcons name="people-outline" size={14} color={colors.textSecondary} /> {group.maxMembers} {t('groups.members')}</Text>
          {group.joinCode ? <Text style={styles.code}>{group.joinCode}</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel={t('common.back')}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('groups.title')}</Text>
          <Text style={styles.subtitle}>{t('groups.subtitle')}</Text>
        </View>
        <Pressable onPress={() => router.push('/study-groups/create' as never)} style={styles.addButton} accessibilityLabel={t('groups.createGroup')}>
          <MaterialIcons name="add" size={23} color={colors.background} />
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <MaterialIcons name="search" size={20} color={colors.textTertiary} />
          <TextInput value={query} onChangeText={value => { setQuery(value); if (!value.trim()) setSearchResults([]); }} onSubmitEditing={handleSearch} placeholder={t('groups.searchPlaceholder')} placeholderTextColor={colors.textTertiary} style={styles.searchInput} returnKeyType="search" />
        </View>
        <Pressable onPress={handleSearch} disabled={searching} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
          <Text style={styles.searchButtonText}>{searching ? '…' : t('groups.searchGroups')}</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={() => router.push('/study-groups/join' as never)} style={styles.secondaryButton}>
          <MaterialIcons name="link" size={17} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>{t('groups.joinByLink')}</Text>
        </Pressable>
        <Text style={styles.sectionLabel}>{query.trim() ? t('groups.searchGroups') : t('groups.myGroups')}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.kind === 'mine' ? (item.entry as MyGroupEntry).group.id : (item.entry as StudyGroup).id}`}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadGroups(true); }} tintColor={colors.primary} />}
        ListEmptyComponent={loading ? <Text style={styles.emptyText}>{t('common.loading')}</Text> : <Text style={styles.emptyText}>{query.trim() ? t('groups.noGroups') : t('groups.noGroups')}</Text>}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: FontSize.xl, lineHeight: 28, fontWeight: FontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18, marginTop: 2 },
  addButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  searchRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  searchInputWrap: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.surface, paddingHorizontal: Spacing.sm },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: FontSize.sm, paddingVertical: 10 },
  searchButton: { backgroundColor: colors.primary, minHeight: 48, paddingHorizontal: 12, borderRadius: Radius.md, justifyContent: 'center' },
  searchButtonText: { color: colors.background, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.primary + '66', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 8 },
  secondaryButtonText: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  sectionLabel: { color: colors.textTertiary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, marginLeft: 'auto' },
  error: { color: colors.danger, paddingHorizontal: Spacing.md, lineHeight: 19 },
  listContent: { padding: Spacing.md, paddingTop: Spacing.xs, gap: Spacing.sm, paddingBottom: 40 },
  emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  groupIcon: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  groupName: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  groupMeta: { color: colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 },
  description: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19 },
  statsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md },
  stat: { color: colors.textSecondary, fontSize: FontSize.xs },
  code: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginLeft: 'auto' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
