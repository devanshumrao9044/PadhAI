import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { LEVELS, getLevelForUser } from '@/constants/levels';
import { useApp } from '@/hooks/useApp';
import { supabase } from '@/services/supabase';
import { getWeeklyZone } from '@/services/weeklyXp';
import { getItem, setItem } from '@/services/storage';
import { readUserCache, writeUserCache } from '@/services/cache';
import { applyTopThreeRankUpdate, type TopThreeCelebrationState } from '@/services/leaderboardCelebration';

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

// ── Hero Badge: single level badge for carousel ──────────────────────────────
function LevelBadge({
  levelDef, isCurrent, size,
}: { levelDef: typeof LEVELS[0]; isCurrent: boolean; size: 'sm' | 'lg' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(isCurrent ? 0.8 : 0.7)).current;

  // `scale` is a stable ref and this entrance animation intentionally runs once.
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const badgeSize = size === 'lg' ? 80 : 54;
  const fontSize = size === 'lg' ? 32 : 20;

  return (
    <Animated.View style={[styles.badgeWrap, { transform: [{ scale }] }]}>
      <View
        style={[
          styles.badgeCircle,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            borderColor: levelDef.color,
            backgroundColor: levelDef.color + (isCurrent ? '33' : '18'),
            borderWidth: isCurrent ? 3 : 1.5,
          },
        ]}
      >
        <Text style={[styles.badgeNum, { fontSize, color: isCurrent ? levelDef.color : levelDef.color + 'AA' }]}>
          {levelDef.rank}
        </Text>
        {isCurrent ? (
          <MaterialIcons name="star" size={12} color={levelDef.color} style={{ marginTop: -2 }} />
        ) : null}
      </View>
      {isCurrent ? (
        <Text style={[styles.badgeLabelCurrent, { color: levelDef.color }]}>
          {levelDef.realisticTitle}
        </Text>
      ) : null}
    </Animated.View>
  );
}

// ── Rank Zone Bar ─────────────────────────────────────────────────────────────
function RankZoneBar({ rank, total }: { rank: number; total: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const safeTotal = Math.max(1, Math.floor(total));
  const safeRank = Math.min(safeTotal, Math.max(1, Math.floor(rank)));
  const demotionCount = Math.floor(safeTotal * 0.4);
  const safetyCount = Math.floor(safeTotal * 0.35);
  const promotionCount = safeTotal - demotionCount - safetyCount;

  const demotionPct = (demotionCount / safeTotal) * 100;
  const safetyPct = (safetyCount / safeTotal) * 100;
  const promotionPct = (promotionCount / safeTotal) * 100;

  // Rank 1 is best and belongs at the promotion end of the bar.
  // A one-player leaderboard is treated as fully promoted rather than demotion.
  const rankPct = safeTotal <= 1 ? 100 : ((safeTotal - safeRank) / (safeTotal - 1)) * 100;
  const zone = getWeeklyZone(safeRank, safeTotal);

  const zoneColor = zone === 'promotion' ? colors.success : zone === 'safety' ? colors.warning : colors.danger;

  return (
    <View style={styles.zoneBarContainer}>
      <View style={styles.zoneLabels}>
        <Text style={[styles.zoneLabel, { color: colors.danger }]}>Demotion zone</Text>
        <Text style={[styles.zoneLabel, { color: colors.warning }]}>Safety zone</Text>
        <Text style={[styles.zoneLabel, { color: colors.success }]}>Promotion zone</Text>
      </View>

      {/* Rank badge above bar */}
      <View style={[styles.rankBadgeAbove, { left: `${rankPct}%` as any, borderColor: zoneColor }]}>
        <Text style={[styles.rankBadgeAboveText, { color: zoneColor }]}>Rank: {safeRank}</Text>
      </View>

      {/* The bar */}
      <View style={styles.zoneBarTrack}>
        <View style={[styles.zoneSegment, { flex: demotionPct, backgroundColor: colors.danger + '88' }]} />
        <View style={[styles.zoneSegment, { flex: safetyPct, backgroundColor: colors.warning + '88' }]} />
        <View style={[styles.zoneSegment, { flex: promotionPct, backgroundColor: colors.success + '88' }]} />
        {/* Indicator dot */}
        <View style={[styles.zoneDot, { left: `${rankPct}%` as any, backgroundColor: zoneColor }]} />
      </View>

      <View style={styles.zoneRankNums}>
        <Text style={styles.zoneRankNum}>{safeTotal}</Text>
        <Text style={styles.zoneRankNum}>{safeTotal - demotionCount}</Text>
        <Text style={styles.zoneRankNum}>{promotionCount}</Text>
        <Text style={styles.zoneRankNum}>1</Text>
      </View>
      <View style={styles.zoneRankLabels}>
        <Text style={styles.zoneRankLabel}>Ranks</Text>
        <Text style={styles.zoneRankLabel}>Ranks</Text>
        <Text style={styles.zoneRankLabel}>Ranks</Text>
      </View>
    </View>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────────────────
function BoardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const levelDef = LEVELS.find(l => l.rank === entry.level) ?? LEVELS[0];
  const rankColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
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
      accessibilityLabel={isTopThree ? `${entry.name}, ${entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : 'bronze'} medal, rank ${entry.rank}, ${entry.xp} XP` : `${entry.name}, rank ${entry.rank}, ${entry.xp} XP`}
      style={[
        styles.boardRow,
        isMe && styles.boardRowMe,
        isTopThree && styles.topThreeRow,
        entry.rank === 1 && styles.firstPlaceRow,
        entry.rank === 2 && styles.secondPlaceRow,
        entry.rank === 3 && styles.thirdPlaceRow,
      ]}
    >
      <View style={[styles.boardRankBadge, isTopThree && styles.medalBadge, { backgroundColor: rankBg + '33', borderColor: rankBg }]}>
        {medalIcon ? <MaterialIcons name={medalIcon} size={16} color={rankBg} /> : null}
        <Text style={[styles.boardRankText, { color: rankBg }]}>{entry.rank}</Text>
      </View>
      <Text style={[styles.boardName, isMe && styles.boardNameMe]} numberOfLines={1}>
        {entry.name}{isMe ? ' (You)' : ''}
      </Text>
      <View style={styles.boardXPBadge}>
        <Text style={styles.boardXPText}>{entry.xp}</Text>
        <View style={styles.xpMiniTag}>
          <Text style={styles.xpMiniText}>XP</Text>
        </View>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useApp();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [celebrationRank, setCelebrationRank] = useState<number | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationStateReady, setCelebrationStateReady] = useState(false);
  const celebrationProgress = useRef(new Animated.Value(0)).current;
  const celebrationAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const celebrationAnimatedStyle = useMemo(() => ({
    opacity: celebrationProgress,
    transform: [{ scale: celebrationProgress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
  }), [celebrationProgress]);
  const previousTopThreeRankRef = useRef<number | null | undefined>(undefined);
  const leaderboardRequestIdRef = useRef(0);

  const currentLevel = user ? getLevelForUser(user) : LEVELS[0];
  const celebrationStorageKey = user?.id
    ? `${TOP_THREE_CELEBRATION_KEY_PREFIX}${user.id}_level_${currentLevel.rank}`
    : null;
  const myEntry = entries.find(e => e.id === user?.id);
  const myRank = myEntry?.rank ?? entries.length + 1;
  const displayEntries = entries.map(entry => entry.id === user?.id && user
    ? { ...entry, xp: user.xpTotal, level: currentLevel.rank }
    : entry);
  const visibleEntries = displayEntries.slice(0, MAX_VISIBLE_LEADERBOARD_ENTRIES);

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

  // Build carousel: show currentLevel ±2 levels
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
        {/* ── Section 1: Hero Level Carousel ────────────────────────────── */}
        <View style={styles.heroSection}>
          {/* Spotlight glow behind current level */}
          <View style={[styles.spotlight, { backgroundColor: currentLevel.color + '20' }]} />

          {/* Level badges row */}
          <View style={styles.badgesRow}>
            {carouselLevels.map(l => (
              <LevelBadge
                key={l.rank}
                levelDef={l}
                isCurrent={l.rank === currentLevel.rank}
                size={l.rank === currentLevel.rank ? 'lg' : 'sm'}
              />
            ))}
          </View>

          {/* Podium label */}
          <View style={[styles.podiumLabel, { backgroundColor: currentLevel.color + '22', borderColor: currentLevel.color + '55' }]}>
            <Text style={[styles.podiumText, { color: currentLevel.color }]}>
              Level {currentLevel.rank} — {currentLevel.realisticTitle}
            </Text>
          </View>

          {/* Podium base */}
          <View style={styles.podiumBase}>
            <View style={[styles.podiumPlatform, { borderColor: currentLevel.color + '55', backgroundColor: currentLevel.color + '18' }]} />
          </View>
        </View>

        {/* ── Section 2: Rank Status Card ───────────────────────────────── */}
        <View style={styles.rankCard}>
          {/* Top info row */}
          <View style={styles.rankCardTop}>
            {/* Left: level badge + title */}
            <View style={styles.rankCardLeft}>
              <View style={[styles.miniLevelBadge, { borderColor: currentLevel.color, backgroundColor: currentLevel.color + '22' }]}>
                <Text style={[styles.miniLevelNum, { color: currentLevel.color }]}>{currentLevel.rank}</Text>
              </View>
              <Text style={[styles.miniLevelLabel, { color: currentLevel.color }]}>Level {currentLevel.rank}</Text>
            </View>
            {/* Right: rank + XP pills */}
            <View style={styles.rankCardRight}>
              <View style={styles.infoPill}>
                <Text style={styles.infoPillLabel}>Rank: </Text>
                <Text style={styles.infoPillVal}>{myRank}</Text>
              </View>
              <View style={[styles.infoPill, { backgroundColor: colors.warning + '22', borderColor: colors.warning + '55' }]}>
                <Text style={[styles.infoPillVal, { color: colors.warning }]}>{user?.xpTotal ?? 0}</Text>
                <View style={styles.xpMiniTag}>
                  <Text style={styles.xpMiniText}>XP</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Zone bar */}
          {entries.length > 0 ? (
            <RankZoneBar rank={myRank} total={entries.length} />
          ) : null}
        </View>

        {/* ── Section 3: Leaderboard List ───────────────────────────────── */}
        <View style={styles.listSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>LEVEL {currentLevel.rank} LEADERBOARD</Text>
              <View testID="leaderboard-live" style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
            </View>
            <Text style={styles.sectionSubtitle}>Top 30 students in your current level · updates every 30 seconds</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading rankings...</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="emoji-events" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No rankings yet.{'\n'}Complete a session to appear!</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {visibleEntries.map(entry => (
                <BoardRow key={entry.id} entry={entry} isMe={entry.id === user?.id} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {celebrationVisible && celebrationRank ? (
        <Animated.View
          testID="top-three-celebration"
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Top three achievement. You reached rank ${celebrationRank}.`}
          style={[styles.celebrationBanner, celebrationAnimatedStyle]}
        >
          <MaterialIcons name="emoji-events" size={26} color="#FFD700" />
          <View style={styles.celebrationCopy}>
            <Text style={styles.celebrationTitle}>Top 3 achievement!</Text>
            <Text style={styles.celebrationSubtitle}>You reached rank {celebrationRank}. Keep it up.</Text>
          </View>
          <MaterialIcons name="star" size={20} color="#FFD700" />
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
    borderColor: '#FFD70088',
    backgroundColor: colors.surface,
  },
  celebrationCopy: { flex: 1 },
  celebrationTitle: { color: '#FFD700', fontSize: FontSize.sm, fontWeight: FontWeight.extraBold },
  celebrationSubtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // ── Section 1 Hero ────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    backgroundColor: '#E8F0FE18',
    overflow: 'hidden',
  },
  spotlight: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -40,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    zIndex: 2,
  },
  badgeWrap: {
    alignItems: 'center',
    gap: 4,
  },
  badgeCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  badgeNum: {
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
    lineHeight: undefined,
  },
  badgeLabelCurrent: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  podiumLabel: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    zIndex: 2,
  },
  podiumText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  podiumBase: {
    alignItems: 'center',
    width: '60%',
    zIndex: 2,
  },
  podiumPlatform: {
    width: '100%',
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
  },

  // ── Section 2 Rank Card ────────────────────────────────────────────────────
  rankCard: {
    backgroundColor: colors.surface,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
  },
  rankCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  rankCardLeft: {
    alignItems: 'center',
    gap: 4,
  },
  miniLevelBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLevelNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  miniLevelLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  rankCardRight: {
    gap: 8,
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  infoPillLabel: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  infoPillVal: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    includeFontPadding: false,
  },

  // ── Zone Bar ───────────────────────────────────────────────────────────────
  zoneBarContainer: { marginTop: Spacing.sm },
  zoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  zoneLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    flex: 1,
    textAlign: 'center',
  },
  rankBadgeAbove: {
    position: 'absolute',
    top: 20,
    marginLeft: -32,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 3,
  },
  rankBadgeAboveText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  zoneBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: Radius.full,
    overflow: 'visible',
    marginBottom: 4,
    position: 'relative',
  },
  zoneSegment: {
    height: '100%',
  },
  zoneDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -3,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  zoneRankNums: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  zoneRankNum: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.semiBold,
  },
  zoneRankLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  zoneRankLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Section 3 List ─────────────────────────────────────────────────────────
  listSection: {
    paddingHorizontal: Spacing.md,
  },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.success + '18', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.success + '55' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold,
    color: colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  sectionSubtitle: { color: colors.textTertiary, fontSize: FontSize.xs, marginBottom: Spacing.sm },
  listContainer: { gap: 6, paddingBottom: Spacing.xl },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topThreeRow: { paddingVertical: Spacing.md + 2 },
  firstPlaceRow: { borderColor: '#FFD700', backgroundColor: '#FFD70012', shadowColor: '#FFD700', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  secondPlaceRow: { borderColor: '#C0C0C0', backgroundColor: '#C0C0C012' },
  thirdPlaceRow: { borderColor: '#CD7F32', backgroundColor: '#CD7F3212' },
  boardRowMe: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  boardRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalBadge: { width: 48, height: 42, borderRadius: 14, gap: 1 },
  boardRankText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  boardName: {
    flex: 1,
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
    gap: 6,
  },
  boardXPText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  xpMiniTag: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  xpMiniText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  separator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  separatorText: {
    fontSize: FontSize.base,
    color: colors.textTertiary,
    letterSpacing: 4,
  },

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
