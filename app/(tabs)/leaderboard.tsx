import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Animated, TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { LEVELS, getLevelForUser } from '@/constants/levels';
import { formatXPValue } from '@/features/progression/services/xpDisplay';
import { useApp } from '@/hooks/useApp';
import { supabase } from '@/features/core/services/supabase';
import { getWeeklyZone } from '@/features/progression/services/weeklyXp';
import { getItem, setItem } from '@/features/core/services/storage';
import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import { applyTopThreeRankUpdate, type TopThreeCelebrationState } from '@/features/leaderboard/services/leaderboardCelebration';
import LeaderboardGuideSheet from '@/components/ui/LeaderboardGuideSheet';

const TOP_THREE_CELEBRATION_KEY_PREFIX = 'padhai_top_three_celebration_v1_';
const MAX_VISIBLE_LEADERBOARD_ENTRIES = 30;

interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  rank: number;
}

type LeaderboardCacheData = {
  level: number;
  entries: LeaderboardEntry[];
};

// ── Podium Card for Top 3 ─────────────────────────────────────────────────────
function PodiumCard({ entry, isMe, height }: { entry: LeaderboardEntry; isMe: boolean; height: number }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const rankColors: Record<number, string> = {
    1: colors.levelLegend,
    2: colors.levelGrinder,
    3: colors.levelConsistent,
  };
  const accent = rankColors[entry.rank] ?? colors.primary;
  const medalIcons: Record<number, 'emoji-events' | 'military-tech' | 'workspace-premium'> = {
    1: 'emoji-events',
    2: 'military-tech',
    3: 'workspace-premium',
  };
  const medalLabel = entry.rank === 1 ? t('leaderboard.goldMedal') : entry.rank === 2 ? t('leaderboard.silverMedal') : t('leaderboard.bronzeMedal');

  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 50,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.podiumCard, { height, transform: [{ scale }] }, isMe && styles.podiumCardMe]}>
      <LinearGradient
        colors={[accent + '22', colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.podiumGradient}
      >
        <View style={[styles.podiumMedal, { backgroundColor: accent + '20', borderColor: accent }]}>
          <MaterialIcons name={medalIcons[entry.rank]} size={entry.rank === 1 ? 28 : 22} color={accent} />
        </View>
        <Text style={[styles.podiumName, isMe && { color: colors.primary }]} numberOfLines={1} ellipsizeMode="tail">
          {isMe ? t('leaderboard.you') : entry.name}
        </Text>
        <Text style={[styles.podiumXP, { color: accent }]}>{formatXPValue(entry.xp)}</Text>
        <Text style={styles.podiumXPLabel}>{t('common.xp')}</Text>
      </LinearGradient>
      <View style={[styles.podiumBase, { backgroundColor: accent, height: entry.rank === 1 ? 8 : entry.rank === 2 ? 6 : 4 }]} />
    </Animated.View>
  );
}

// ── Rank Zone Bar ─────────────────────────────────────────────────────────────
function RankZoneBar({ rank, total }: { rank: number; total: number }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const safeTotal = Math.max(1, Math.floor(total));
  const safeRank = Math.min(safeTotal, Math.max(1, Math.floor(rank)));
  const demotionCount = Math.floor(safeTotal * 0.4);
  const safetyCount = Math.floor(safeTotal * 0.35);
  const promotionCount = safeTotal - demotionCount - safetyCount;

  const demotionPct = (demotionCount / safeTotal) * 100;
  const safetyPct = (safetyCount / safeTotal) * 100;
  const promotionPct = (promotionCount / safeTotal) * 100;

  const rankPct = safeTotal <= 1 ? 100 : ((safeTotal - safeRank) / (safeTotal - 1)) * 100;
  const safeRankPct = Math.max(8, Math.min(92, rankPct));
  const zone = getWeeklyZone(safeRank, safeTotal);
  const zoneColor = zone === 'promotion' ? colors.success : zone === 'safety' ? colors.warning : colors.danger;

  return (
    <View style={styles.zoneBarContainer}>
      <View style={styles.zoneLabels}>
        <Text numberOfLines={1} style={[styles.zoneLabel, { color: colors.danger }]}>{t('leaderboard.demotionZone')}</Text>
        <Text numberOfLines={1} style={[styles.zoneLabel, { color: colors.warning }]}>{t('leaderboard.safetyZone')}</Text>
        <Text numberOfLines={1} style={[styles.zoneLabel, { color: colors.success }]}>{t('leaderboard.promotionZone')}</Text>
      </View>

      <View style={[styles.rankBadgeAbove, { left: `${safeRankPct}%` as any, borderColor: colors.primary, backgroundColor: colors.surfaceVariant }]}>
        <Text style={[styles.rankBadgeAboveText, { color: colors.textPrimary }]}>{t('leaderboard.rank')}: {safeRank}</Text>
        <View style={[styles.rankPointerTail, { borderTopColor: colors.primary }]} />
      </View>

      <View style={styles.zoneBarTrack}>
        <View style={[styles.zoneSegment, { flex: demotionPct, backgroundColor: colors.danger + '66' }]} />
        <View style={[styles.zoneSegment, { flex: safetyPct, backgroundColor: colors.warning + '66' }]} />
        <View style={[styles.zoneSegment, { flex: promotionPct, backgroundColor: colors.success + '66' }]} />
        <View style={[styles.zoneDot, { left: `${safeRankPct}%` as any, backgroundColor: zoneColor }]} />
      </View>

      <View style={styles.zoneRankNums}>
        <Text style={styles.zoneRankNum}>{safeTotal}</Text>
        <Text style={styles.zoneRankNum}>{safeTotal - demotionCount}</Text>
        <Text style={styles.zoneRankNum}>{promotionCount}</Text>
        <Text style={styles.zoneRankNum}>1</Text>
      </View>
    </View>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────────────────
function BoardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const levelDef = LEVELS.find(l => l.rank === entry.level) ?? LEVELS[0];
  const rankColors: Record<number, string> = { 1: colors.levelLegend, 2: colors.levelGrinder, 3: colors.levelConsistent };
  const rankBg = rankColors[entry.rank] ?? levelDef.color;
  const medalIcons: Record<number, 'emoji-events' | 'military-tech' | 'workspace-premium'> = {
    1: 'emoji-events',
    2: 'military-tech',
    3: 'workspace-premium',
  };
  const isTopThree = entry.rank <= 3;
  const medalIcon = medalIcons[entry.rank];

  return (
    <View
      accessibilityLabel={`${entry.name}, ${t('leaderboard.rank')} ${entry.rank}, ${entry.xp} ${t('common.xp')}`}
      style={[
        styles.boardRow,
        isMe && styles.boardRowMe,
        isTopThree && styles.topThreeRow,
        entry.rank === 1 && styles.firstPlaceRow,
      ]}
    >
      <View style={[styles.boardRankBadge, isTopThree && styles.medalBadge, { backgroundColor: rankBg + '20', borderColor: rankBg + '88' }]}>
        {medalIcon ? <MaterialIcons name={medalIcon} size={16} color={rankBg} /> : null}
        <Text style={[styles.boardRankText, { color: colors.textPrimary }]}>{entry.rank}</Text>
      </View>
      <Text style={[styles.boardName, isMe && styles.boardNameMe]} numberOfLines={1} ellipsizeMode="tail">
        {entry.name}{isMe ? ` (${t('leaderboard.you')})` : ''}
      </Text>
      <View style={styles.boardXPBadge}>
        <Text style={styles.boardXPText}>{formatXPValue(entry.xp)}</Text>
        <Text style={styles.xpMiniText}>{t('common.xp')}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useApp();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [celebrationRank, setCelebrationRank] = useState<number | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationStateReady, setCelebrationStateReady] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const celebrationProgress = useRef(new Animated.Value(0)).current;
  const celebrationAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const celebrationAnimatedStyle = useMemo(() => ({
    opacity: celebrationProgress,
    transform: [{ scale: celebrationProgress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
  }), [celebrationProgress]);
  const previousTopThreeRankRef = useRef<number | null | undefined>(undefined);
  const leaderboardRequestIdRef = useRef(0);

  const currentLevel = user ? getLevelForUser(user) : LEVELS[0];
  const currentLevelTitle = currentLevel.rank === 1 ? t('profile.levelBeginner')
    : currentLevel.rank === 2 ? t('profile.levelGrinder')
    : currentLevel.rank === 3 ? t('profile.levelConsistent')
    : currentLevel.rank === 4 ? t('profile.levelBeast')
    : t('profile.levelLegend');
  const celebrationStorageKey = user?.id
    ? `${TOP_THREE_CELEBRATION_KEY_PREFIX}${user.id}_level_${currentLevel.rank}`
    : null;
  const myEntry = entries.find(e => e.id === user?.id);
  const myRank = myEntry?.rank ?? entries.length + 1;
  const displayEntries = entries.map(entry => entry.id === user?.id && user
    ? { ...entry, xp: user.xpTotal, level: currentLevel.rank }
    : entry);
  const visibleEntries = displayEntries.slice(0, MAX_VISIBLE_LEADERBOARD_ENTRIES);
  const podiumEntries = displayEntries.slice(0, 3);
  const restEntries = displayEntries.slice(3, MAX_VISIBLE_LEADERBOARD_ENTRIES);
  const daysUntilReset = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : 7 - day;
  }, []);

  const triggerTopThreeCelebration = useCallback((rank: number) => {
    celebrationAnimationRef.current?.stop();

    setCelebrationRank(rank);
    setCelebrationVisible(true);
    celebrationProgress.setValue(0);

    const animation = Animated.sequence([
      Animated.timing(celebrationProgress, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.delay(1900),
      Animated.timing(celebrationProgress, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);

    celebrationAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (celebrationAnimationRef.current === animation) {
        celebrationAnimationRef.current = null;
      }
      if (finished) {
        setCelebrationVisible(false);
      }
    });
  }, [celebrationProgress]);

  useEffect(() => {
    previousTopThreeRankRef.current = undefined;
    setCelebrationStateReady(false);

    if (!celebrationStorageKey) {
      setCelebrationStateReady(true);
      return;
    }

    let active = true;
    void getItem<TopThreeCelebrationState>(celebrationStorageKey).then(state => {
      if (!active) return;
      previousTopThreeRankRef.current = state?.rank ?? null;
      setCelebrationStateReady(true);
    });

    return () => {
      active = false;
    };
  }, [celebrationStorageKey]);

  useEffect(() => () => {
    celebrationAnimationRef.current?.stop();
    celebrationAnimationRef.current = null;
  }, []);

  const syncLeaderboard = useCallback(async (showSpinner = true) => {
    if (!celebrationStateReady || !user?.id) return;
    const requestId = ++leaderboardRequestIdRef.current;
    if (showSpinner) setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_level_leaderboard', {
        p_level: currentLevel.rank,
      });
      if (requestId !== leaderboardRequestIdRef.current) return;
      if (!error && data) {
        const nextEntries = data as LeaderboardEntry[];
        setEntries(nextEntries);
        void writeUserCache<LeaderboardCacheData>(user.id, 'leaderboard', {
          level: currentLevel.rank,
          entries: nextEntries,
        });

        if (celebrationStorageKey) {
          const currentRank = nextEntries.find(entry => entry.id === user.id)?.rank ?? null;
          const previousRank = previousTopThreeRankRef.current;
          previousTopThreeRankRef.current = currentRank;

          void applyTopThreeRankUpdate({
            previousRank,
            currentRank,
            persist: state => setItem<TopThreeCelebrationState>(celebrationStorageKey, state),
            onCelebrate: triggerTopThreeCelebration,
          });
        }
      }
    } catch (e) {
      console.log('Leaderboard fetch error:', e);
    } finally {
      if (showSpinner && requestId === leaderboardRequestIdRef.current) setLoading(false);
    }
  }, [celebrationStateReady, celebrationStorageKey, currentLevel.rank, triggerTopThreeCelebration, user?.id]);

  const loadLeaderboard = useCallback(async () => {
    if (!celebrationStateReady || !user?.id) return;
    const cached = await readUserCache<LeaderboardCacheData>(user.id, 'leaderboard');
    const hasMatchingCache = cached?.data.level === currentLevel.rank;
    if (hasMatchingCache) {
      setEntries(cached.data.entries);
      setLoading(false);
    }
    await syncLeaderboard(!hasMatchingCache);
  }, [celebrationStateReady, currentLevel.rank, syncLeaderboard, user?.id]);

  useFocusEffect(useCallback(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncLeaderboard(false);
    setRefreshing(false);
  }, [syncLeaderboard]);

  const carouselLevels = LEVELS.filter(
    l => Math.abs(l.rank - currentLevel.rank) <= 2
  );

  return (
    <SafeAreaView testID="leaderboard-screen" style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            style={styles.headerIconButton}
          >
            <MaterialIcons name="arrow-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('leaderboard.pageTitle')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('rewards.title')}
              onPress={() => router.push('/rewards' as Parameters<typeof router.push>[0])}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="emoji-events" size={26} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('leaderboard.openGuide')}
              onPress={() => setGuideVisible(true)}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="help-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section 1: Level Hero ──────────────────────────────────────────── */}
        <LinearGradient
          colors={[colors.background, colors.surfaceVariant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroSection}
        >
          <View style={[styles.spotlight, { backgroundColor: currentLevel.color + '18' }]} />

          {/* Level carousel */}
          <View style={styles.badgesRow}>
            {carouselLevels.map(l => {
              const isCurrent = l.rank === currentLevel.rank;
              const badgeSize = isCurrent ? 76 : 48;
              return (
                <View key={l.rank} style={[styles.badgeWrap, isCurrent && styles.currentBadgeWrap]}>
                  <View style={[styles.badgeShield, {
                    width: badgeSize, height: badgeSize, borderRadius: badgeSize * 0.26,
                    backgroundColor: l.color + (isCurrent ? '22' : '14'),
                    borderColor: isCurrent ? colors.surface : l.color + '66',
                    borderWidth: isCurrent ? 3 : 2,
                  }]}>
                    <Text style={[styles.badgeNum, { fontSize: isCurrent ? 26 : 16, color: l.color }]}>{l.rank}</Text>
                  </View>
                  {isCurrent ? (
                    <Text style={[styles.badgeLabelCurrent, { color: colors.textPrimary }]}>
                      {currentLevelTitle}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.levelLabel}>
            <Text style={styles.levelLabelText}>
              {t('leaderboard.level', { value: currentLevel.rank })}
            </Text>
          </View>
        </LinearGradient>

        {/* ── Section 2: Podium (Top 3) ──────────────────────────────────────── */}
        {!loading && podiumEntries.length > 0 && (
          <View style={styles.podiumSection}>
            <View style={styles.podiumRow}>
              {/* 2nd place */}
              {podiumEntries[1] ? (
                <PodiumCard entry={podiumEntries[1]} isMe={podiumEntries[1].id === user?.id} height={120} />
              ) : <View style={styles.podiumPlaceholder} />}
              {/* 1st place — tallest */}
              {podiumEntries[0] ? (
                <PodiumCard entry={podiumEntries[0]} isMe={podiumEntries[0].id === user?.id} height={150} />
              ) : <View style={styles.podiumPlaceholder} />}
              {/* 3rd place */}
              {podiumEntries[2] ? (
                <PodiumCard entry={podiumEntries[2]} isMe={podiumEntries[2].id === user?.id} height={100} />
              ) : <View style={styles.podiumPlaceholder} />}
            </View>
          </View>
        )}

        {/* ── Section 3: Rank Status Card ────────────────────────────────────── */}
        <View style={styles.rankCard}>
          <View style={styles.weeklyUpdateCard}>
            <MaterialIcons name="schedule" size={22} color={colors.textSecondary} />
            <View style={styles.weeklyUpdateCopy}>
              <Text style={styles.weeklyUpdateLabel}>{t('leaderboard.updatesInLabel')}</Text>
              <Text style={styles.weeklyUpdateValue}>{t('leaderboard.daysValue', { value: daysUntilReset })}</Text>
            </View>
          </View>

          {entries.length > 0 ? (
            <RankZoneBar rank={myRank} total={entries.length} />
          ) : null}
        </View>

        {/* ── Section 4: Leaderboard List ───────────────────────────────────── */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>{t('leaderboard.title', { value: currentLevel.rank })}</Text>
            <View testID="leaderboard-live" style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t('leaderboard.live')}</Text>
            </View>
          </View>

          {!loading && entries.length > 0 && getWeeklyZone(myRank, entries.length) !== 'promotion' ? (
            <View style={styles.promotionHint}>
              <MaterialIcons name="arrow-upward" size={20} color={colors.success} />
              <Text style={styles.promotionHintText}>{t('leaderboard.rankHigherToPromoted')}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('leaderboard.loading')}</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="emoji-events" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('leaderboard.noRankings')}</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {restEntries.length > 0 && podiumEntries.length >= 3 && (
                <View style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>4+</Text>
                  <View style={styles.separatorLine} />
                </View>
              )}
              {restEntries.map(entry => (
                <BoardRow key={entry.id} entry={entry} isMe={entry.id === user?.id} />
              ))}
              {podiumEntries.length < 3 && visibleEntries.map(entry => (
                <BoardRow key={entry.id} entry={entry} isMe={entry.id === user?.id} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <LeaderboardGuideSheet visible={guideVisible} onClose={() => setGuideVisible(false)} />

      {celebrationVisible && celebrationRank ? (
        <Animated.View
          testID="top-three-celebration"
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Top three achievement. You reached rank ${celebrationRank}.`}
          style={[styles.celebrationBanner, celebrationAnimatedStyle]}
        >
          <MaterialIcons name="emoji-events" size={26} color={colors.levelLegend} />
          <View style={styles.celebrationCopy}>
            <Text style={styles.celebrationTitle}>{t('leaderboard.topThreeAchievement')}</Text>
            <Text style={styles.celebrationSubtitle}>{t('leaderboard.reachedRank', { value: celebrationRank })}</Text>
          </View>
          <MaterialIcons name="star" size={20} color={colors.levelLegend} />
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  celebrationBanner: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.levelLegend + '88',
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  celebrationCopy: { flex: 1 },
  celebrationTitle: { color: colors.levelLegend, fontSize: FontSize.sm, fontWeight: FontWeight.extraBold },
  celebrationSubtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // ── Header ──────────────────────────────────────────────────────────────
  pageHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extraBold,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // ── Hero Section ─────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    overflow: 'hidden',
  },
  spotlight: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: 0,
    opacity: 0.5,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 120,
    marginBottom: Spacing.sm,
    zIndex: 2,
  },
  badgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 50,
  },
  currentBadgeWrap: {
    minWidth: 100,
    paddingBottom: 4,
  },
  badgeShield: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  badgeNum: {
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  badgeLabelCurrent: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  levelLabel: {
    alignItems: 'center',
    zIndex: 2,
  },
  levelLabelText: {
    fontSize: FontSize.lg,
    lineHeight: 24,
    fontWeight: FontWeight.extraBold,
    color: colors.textSecondary,
  },

  // ── Podium Section ───────────────────────────────────────────────────────
  podiumSection: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  podiumPlaceholder: {
    flex: 1,
  },
  podiumCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  podiumCardMe: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  podiumGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  podiumMedal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  podiumXP: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  podiumXPLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  podiumBase: {
    width: '100%',
  },

  // ── Rank Card ────────────────────────────────────────────────────────────
  rankCard: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#1C2D44', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  weeklyUpdateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weeklyUpdateCopy: {
    flex: 1,
  },
  weeklyUpdateLabel: {
    color: colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  weeklyUpdateValue: {
    color: colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold,
    marginTop: 2,
  },

  // ── Zone Bar ──────────────────────────────────────────────────────────────
  zoneBarContainer: { marginTop: Spacing.sm, overflow: 'hidden', paddingTop: 30 },
  zoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  zoneLabel: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontWeight: FontWeight.semiBold,
    flex: 1,
    textAlign: 'center',
  },
  rankBadgeAbove: {
    position: 'absolute',
    top: 18,
    marginLeft: -44,
    minWidth: 88,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 3,
  },
  rankBadgeAboveText: {
    fontSize: FontSize.base,
    lineHeight: 20,
    fontWeight: FontWeight.extraBold,
  },
  rankPointerTail: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  zoneBarTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: 4,
    position: 'relative',
  },
  zoneSegment: {
    height: '100%',
  },
  zoneDot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    top: -6,
    marginLeft: -12,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  zoneRankNums: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  zoneRankNum: {
    fontSize: FontSize.xs,
    color: colors.textTertiary,
    fontWeight: FontWeight.semiBold,
  },

  // ── List Section ──────────────────────────────────────────────────────────
  listSection: {
    paddingHorizontal: Spacing.md,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extraBold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '18',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.success + '55',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  promotionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  promotionHintText: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  listContainer: { gap: 8, paddingBottom: Spacing.xl },

  // ── Board Row ─────────────────────────────────────────────────────────────
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  topThreeRow: {
    borderWidth: 1.5,
  },
  firstPlaceRow: {
    borderColor: colors.levelLegend + '66',
    ...Platform.select({
      ios: { shadowColor: colors.levelLegend, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  boardRowMe: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primary + '08',
  },
  boardRankBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
  },
  medalBadge: { width: 42, height: 42, borderRadius: 12 },
  boardRankText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  boardName: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: colors.textPrimary,
  },
  boardNameMe: {
    color: colors.primary,
    fontWeight: FontWeight.bold,
  },
  boardXPBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boardXPText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold,
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  xpMiniText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },

  // ── Separator ──────────────────────────────────────────────────────────────
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    fontSize: FontSize.xs,
    color: colors.textTertiary,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },

  // ── States ─────────────────────────────────────────────────────────────────
  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: colors.textSecondary,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
