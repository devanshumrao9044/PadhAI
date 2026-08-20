import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DarkColors, ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { LEVELS, getLevelForUser } from '@/constants/levels';
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

// ── Hero Badge: reference-style winged shield for the level carousel ───────────
function LevelBadge({
  levelDef, isCurrent, size,
}: { levelDef: typeof LEVELS[0]; isCurrent: boolean; size: 'sm' | 'lg' }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(isCurrent ? 0.86 : 0.76)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const badgeSize = size === 'lg' ? 92 : 56;
  const fontSize = size === 'lg' ? 30 : 18;
  const wingHeight = size === 'lg' ? 28 : 19;

  return (
    <Animated.View style={[styles.badgeWrap, isCurrent && styles.currentBadgeWrap, { transform: [{ scale }] }]}>
      <View style={[styles.badgeAssembly, { width: badgeSize + 48, height: badgeSize + 30 }]}>
        <View style={[styles.badgeWing, { width: badgeSize * 0.48, height: wingHeight, backgroundColor: levelDef.color + '88', left: 0, transform: [{ rotate: '-18deg' }] }]} />
        <View style={[styles.badgeWing, { width: badgeSize * 0.48, height: wingHeight, backgroundColor: levelDef.color + '88', right: 0, transform: [{ rotate: '18deg' }] }]} />
        <View style={[styles.badgeShield, { width: badgeSize, height: badgeSize, borderRadius: badgeSize * 0.24, backgroundColor: levelDef.color, borderColor: isCurrent ? '#FFFFFF' : levelDef.color + 'DD', borderWidth: isCurrent ? 3 : 2, transform: [{ rotate: '30deg' }] }]}>
          <View style={[styles.badgeShieldInner, { borderColor: '#FFFFFF88' }]}>
            <Text style={[styles.badgeNum, { fontSize, color: '#FFFFFF', transform: [{ rotate: '-30deg' }] }]}>{levelDef.rank}</Text>
          </View>
        </View>
        <View style={[styles.badgeRibbon, { backgroundColor: isCurrent ? '#F7C948' : '#D9A441', bottom: 0, width: badgeSize * 0.46, height: size === 'lg' ? 18 : 12 }]} />
      </View>
      {isCurrent ? (
        <Text style={[styles.badgeLabelCurrent, { color: colors.textPrimary }]}>
          {(levelDef.rank === 1 ? t('profile.levelBeginner')
            : levelDef.rank === 2 ? t('profile.levelGrinder')
            : levelDef.rank === 3 ? t('profile.levelConsistent')
            : levelDef.rank === 4 ? t('profile.levelBeast')
            : t('profile.levelLegend'))}
        </Text>
      ) : null}
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

  // Rank 1 is best and belongs at the promotion end of the bar.
  // A one-player leaderboard is treated as fully promoted rather than demotion.
  const rankPct = safeTotal <= 1 ? 100 : ((safeTotal - safeRank) / (safeTotal - 1)) * 100;
  // Keep the badge and indicator fully inside the rounded track at both edges.
  const safeRankPct = Math.max(12, Math.min(88, rankPct));
  const zone = getWeeklyZone(safeRank, safeTotal);

  const zoneColor = zone === 'promotion' ? colors.success : zone === 'safety' ? colors.warning : colors.danger;
  const zoneLabel = zone === 'promotion' ? t('leaderboard.promotionZone') : zone === 'safety' ? t('leaderboard.safetyZone') : t('leaderboard.demotionZone');

  return (
    <View style={styles.zoneBarContainer}>
      <View style={styles.zoneStatusRow}>
        <View style={[styles.zoneStatusPill, { backgroundColor: zoneColor + '18', borderColor: zoneColor + '66' }]}>
          <View style={[styles.zoneStatusDot, { backgroundColor: zoneColor }]} />
          <Text style={[styles.zoneStatusText, { color: zoneColor }]}>{t('leaderboard.rank')} {safeRank} · {zoneLabel}</Text>
        </View>
        <Text style={styles.zoneTotalText}>{safeTotal} {t('leaderboard.students')}</Text>
      </View>

      <View style={styles.zoneLabels}>
        <Text numberOfLines={2} style={[styles.zoneLabel, { color: colors.danger }]}>{t('leaderboard.demotionZone')}</Text>
        <Text numberOfLines={2} style={[styles.zoneLabel, { color: colors.warning }]}>{t('leaderboard.safetyZone')}</Text>
        <Text numberOfLines={2} style={[styles.zoneLabel, { color: colors.success }]}>{t('leaderboard.promotionZone')}</Text>
      </View>

      <View style={styles.zoneBarTrack} accessibilityLabel={`${t('leaderboard.rank')} ${safeRank} ${zoneLabel}`}>
        <View style={[styles.zoneSegment, { flex: demotionPct, backgroundColor: colors.danger + 'AA' }]} />
        <View style={[styles.zoneSegment, { flex: safetyPct, backgroundColor: colors.warning + 'AA' }]} />
        <View style={[styles.zoneSegment, { flex: promotionPct, backgroundColor: colors.success + 'AA' }]} />
        <View style={[styles.zoneIndicatorLine, { left: `${safeRankPct}%` as any, backgroundColor: zoneColor }]} />
      </View>

      <View style={styles.zoneScaleRow}>
        <Text style={styles.zoneScaleText}>{safeTotal}</Text>
        <Text style={styles.zoneScaleText}>{promotionCount}</Text>
        <Text style={styles.zoneScaleText}>1</Text>
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
  const rankColors: Record<number, string> = { 1: '#F2B600', 2: '#2D8FCE', 3: '#4CA878' };
  const rankBg = rankColors[entry.rank] ?? levelDef.color;
  const isTopThree = entry.rank <= 3;
  const rowColors: [string, string] = isMe
    ? [colors.primary + '38', colors.surface + 'B8']
    : isTopThree
    ? [rankBg + '30', colors.surface + 'D9']
    : [colors.surfaceVariant + 'C8', colors.surface + 'D9'];

  return (
    <LinearGradient
      accessibilityLabel={`${entry.name}, ${t('leaderboard.rank')} ${entry.rank}, ${entry.xp} ${t('common.xp')}`}
      colors={rowColors}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[
        styles.boardRow,
        isMe && styles.boardRowMe,
        isTopThree && styles.topThreeRow,
        entry.rank === 1 && styles.firstPlaceRow,
        entry.rank === 2 && styles.secondPlaceRow,
        entry.rank === 3 && styles.thirdPlaceRow,
      ]}
    >
      <View style={[styles.boardRankBadge, isTopThree && styles.medalBadge, { backgroundColor: rankBg + '32', borderColor: rankBg }]}>
        <Text style={[styles.boardRankText, { color: colors.textPrimary }]}>{entry.rank}</Text>
      </View>
      <Text style={[styles.boardName, isMe && styles.boardNameMe]} numberOfLines={2} ellipsizeMode="tail">
        {entry.name}{isMe ? ` (${t('leaderboard.you')})` : ''}
      </Text>
      <View style={styles.boardXPBadge}>
        <Text style={styles.boardXPText}>{entry.xp}</Text>
        <Text style={styles.boardXPLabel}>{t('common.xp')}</Text>
      </View>
    </LinearGradient>
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
  const screenEntranceProgress = useRef(new Animated.Value(0)).current;
  const rankCardProgress = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(0.72)).current;
  const celebrationAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const celebrationAnimatedStyle = useMemo(() => ({
    opacity: celebrationProgress,
    transform: [{ scale: celebrationProgress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
  }), [celebrationProgress]);
  const screenEntranceStyle = useMemo(() => ({
    opacity: screenEntranceProgress,
    transform: [{ translateY: screenEntranceProgress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  }), [screenEntranceProgress]);
  const rankCardEntranceStyle = useMemo(() => ({
    opacity: rankCardProgress,
    transform: [{ translateY: rankCardProgress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  }), [rankCardProgress]);
  const previousTopThreeRankRef = useRef<number | null | undefined>(undefined);
  const isDarkTheme = colors.background === DarkColors.background;
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
    Animated.parallel([
      Animated.timing(screenEntranceProgress, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(70),
        Animated.timing(rankCardProgress, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 0.72, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [livePulse, rankCardProgress, screenEntranceProgress]);

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
        <View style={styles.pageHeader}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            style={styles.headerIconButton}
          >
            <MaterialIcons name="arrow-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('leaderboard.pageTitle')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('rewards.title')}
              onPress={() => router.push('/rewards' as Parameters<typeof router.push>[0])}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="emoji-events" size={30} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('leaderboard.openGuide')}
              onPress={() => setGuideVisible(true)}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="help-outline" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={screenEntranceStyle}>
        {/* ── Section 1: Hero Level Carousel ────────────────────────────── */}
        <BlurView
          intensity={isDarkTheme ? 44 : 62}
          tint={isDarkTheme ? 'dark' : 'light'}
          style={styles.heroSection}
        >
          <LinearGradient
            colors={[colors.primary + '18', colors.surface + '66', colors.background + '18']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Spotlight glow behind current level */}
          <View style={[styles.spotlight, { backgroundColor: currentLevel.color + '20' }]} />

          {/* Level badges row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.badgesScroll}
            contentContainerStyle={styles.badgesRow}
          >
            {carouselLevels.map(l => (
              <LevelBadge
                key={l.rank}
                levelDef={l}
                isCurrent={l.rank === currentLevel.rank}
                size={l.rank === currentLevel.rank ? 'lg' : 'sm'}
              />
            ))}
          </ScrollView>

          {/* Center level title */}
          <View style={styles.levelLabel}>
            <Text style={styles.levelLabelText}>
              {t('leaderboard.level', { value: currentLevel.rank })}
            </Text>
            <Text style={[styles.levelSubtitle, { color: currentLevel.color }]}>{currentLevelTitle}</Text>
          </View>

        </BlurView>

        {/* ── Section 2: Rank Status Card ───────────────────────────────── */}
        <Animated.View style={[styles.rankCard, rankCardEntranceStyle]}>
          <View style={styles.rankSummaryRow}>
            <View style={styles.rankSummaryCard}>
              <Text style={styles.rankSummaryLabel}>{t('leaderboard.currentRank')}</Text>
              <Text style={styles.rankSummaryValue}>#{myRank}</Text>
            </View>
            <View style={styles.rankSummaryCard}>
              <Text style={styles.rankSummaryLabel}>{t('home.weeklyXP')}</Text>
              <Text style={[styles.rankSummaryValue, { color: colors.warning }]}>{user?.xpTotal ?? 0}</Text>
            </View>
            <View style={styles.rankSummaryCard}>
              <Text style={styles.rankSummaryLabel}>{t('leaderboard.updatesInLabel')}</Text>
              <Text style={styles.rankSummaryValue}>{daysUntilReset} {t('leaderboard.days')}</Text>
            </View>
          </View>

          {/* Zone bar */}
          {entries.length > 0 ? (
            <RankZoneBar rank={myRank} total={entries.length} />
          ) : null}
        </Animated.View>

        {/* ── Section 3: Leaderboard List ───────────────────────────────── */}
        <View style={styles.listSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>{t('leaderboard.title', { value: currentLevel.rank })}</Text>
              <View testID="leaderboard-live" style={styles.livePill}><Animated.View style={[styles.liveDot, { opacity: livePulse, transform: [{ scale: livePulse }] }]} /><Text style={styles.liveText}>{t('leaderboard.live')}</Text></View>
            </View>
            <Text style={styles.sectionSubtitle}>{t('leaderboard.subtitle')}</Text>

          {!loading && entries.length > 0 && getWeeklyZone(myRank, entries.length) !== 'promotion' ? (
            <View style={styles.promotionHint}>
              <MaterialIcons name="arrow-upward" size={22} color={colors.success} />
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
              <Text style={styles.emptyText}>{t('leaderboard.noRankings')}{'\n'}</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {visibleEntries.map(entry => (
                <BoardRow key={entry.id} entry={entry} isMe={entry.id === user?.id} />
              ))}
            </View>
          )}
        </View>
        </Animated.View>
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
          <MaterialIcons name="emoji-events" size={26} color="#FFD700" />
          <View style={styles.celebrationCopy}>
            <Text style={styles.celebrationTitle}>{t('leaderboard.topThreeAchievement')}</Text>
            <Text style={styles.celebrationSubtitle}>{t('leaderboard.reachedRank', { value: celebrationRank })}</Text>
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
    borderColor: colors.warning + '99',
    backgroundColor: colors.surface + 'E6',
  },
  celebrationCopy: { flex: 1 },
  celebrationTitle: { color: colors.warning, fontSize: FontSize.sm, fontWeight: FontWeight.extraBold },
  celebrationSubtitle: { color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  pageHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    marginLeft: 4,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: FontWeight.extraBold,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ── Section 1 Hero ────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    minHeight: 248,
    paddingTop: 20,
    paddingBottom: 22,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.surface + '42',
  },
  spotlight: {
    position: 'absolute',
    width: 150,
    height: 230,
    borderRadius: 76,
    top: 18,
    opacity: 0.28,
  },
  badgesScroll: { width: '100%', zIndex: 2 },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 168,
    paddingHorizontal: Spacing.lg,
    marginBottom: 2,
  },
  badgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 62,
  },
  currentBadgeWrap: {
    minWidth: 128,
    paddingTop: 8,
  },
  badgeAssembly: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeWing: {
    position: 'absolute',
    top: '44%',
    borderRadius: 8,
  },
  badgeShield: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeShieldInner: {
    width: '76%',
    height: '76%',
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRibbon: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF88',
  },
  badgeNum: {
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
    lineHeight: undefined,
  },
  badgeLabelCurrent: {
    fontSize: FontSize.xl,
    lineHeight: 28,
    fontWeight: FontWeight.extraBold,
    marginTop: -4,
  },
  levelLabel: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    marginTop: -2,
    marginBottom: 12,
    zIndex: 2,
  },
  levelLabelText: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: FontWeight.extraBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  levelSubtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: FontWeight.bold,
    marginTop: -2,
    textAlign: 'center',
  },

  // ── Section 2 Rank Card ────────────────────────────────────────────────────
  rankCard: {
    backgroundColor: colors.surface + 'D9',
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: Spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  rankSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  rankSummaryCard: { flex: 1, minWidth: 0, minHeight: 74, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: colors.surfaceVariant + 'CC', borderWidth: 1, borderColor: colors.borderStrong },
  rankSummaryLabel: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, textAlign: 'center', flexShrink: 1 },
  rankSummaryValue: { color: colors.textPrimary, fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.extraBold, textAlign: 'center', marginTop: 2, flexShrink: 1 },
  weeklyUpdateCard: { display: 'none' },
  weeklyUpdateCopy: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyUpdateLabel: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: FontWeight.semiBold,
    textAlign: 'center',
  },
  weeklyUpdateValue: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: FontWeight.extraBold,
    textAlign: 'center',
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
  zoneBarContainer: { marginTop: Spacing.sm, overflow: 'hidden', paddingTop: 2 },
  zoneStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  zoneStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '78%', borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  zoneStatusDot: { width: 8, height: 8, borderRadius: 4 },
  zoneStatusText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.bold, flexShrink: 1 },
  zoneTotalText: { color: colors.textTertiary, fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, flexShrink: 1, textAlign: 'right' },
  zoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 8,
  },
  zoneLabel: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontWeight: FontWeight.bold,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  zoneBarTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: colors.surfaceVariant,
  },
  zoneSegment: {
    height: '100%',
  },
  zoneIndicatorLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    marginLeft: -2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  zoneScaleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  zoneScaleText: { fontSize: FontSize.xs, lineHeight: 16, color: colors.textTertiary, fontWeight: FontWeight.semiBold },

  // ── Section 3 List ─────────────────────────────────────────────────────────
  listSection: {
    paddingHorizontal: Spacing.md,
  },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  livePill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.success + '20', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.success + '88' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 10, lineHeight: 14, fontWeight: FontWeight.bold, letterSpacing: 0.6 },
  sectionTitle: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold, flexShrink: 1 },
  sectionSubtitle: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18, marginBottom: 10, flexShrink: 1 },
  promotionHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderRadius: Radius.md, backgroundColor: colors.success + '12', borderWidth: 1, borderColor: colors.success + '44' },
  promotionHintText: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: FontSize.sm, lineHeight: 19, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  listContainer: { gap: 10, paddingBottom: Spacing.xl },
  boardRow: {
    minHeight: 76,
    backgroundColor: colors.surface + 'B8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  topThreeRow: { minHeight: 84, paddingVertical: 12 },
  firstPlaceRow: { borderColor: '#F2B60088', shadowColor: '#F2B600', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  secondPlaceRow: { borderColor: '#2D8FCE66' },
  thirdPlaceRow: { borderColor: '#4CA87866' },
  boardRowMe: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  boardRankBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalBadge: { width: 44, height: 44, borderRadius: Radius.md },
  boardRankText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  boardName: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.base,
    lineHeight: 20,
    fontWeight: FontWeight.semiBold,
    color: colors.textPrimary,
  },
  boardNameMe: {
    color: colors.primary,
    fontWeight: FontWeight.bold,
  },
  boardXPBadge: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 60,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boardXPText: {
    fontSize: FontSize.lg,
    lineHeight: 24,
    fontWeight: FontWeight.extraBold,
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  boardXPLabel: { color: colors.textSecondary, fontSize: FontSize.xs, lineHeight: 15, fontWeight: FontWeight.bold },
  xpShield: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCEAF9',
    borderWidth: 1.5,
    borderColor: '#AFC8E3',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '30deg' }],
  },
  xpShieldInner: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-30deg' }],
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
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#39526F',
    letterSpacing: 0.2,
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
