import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { LEVELS, getLevelForXP } from '@/constants/levels';
import { useApp } from '@/hooks/useApp';
import { supabase } from '@/services/supabase';

interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  rank: number;
}

// ── Hero Badge: single level badge for carousel ──────────────────────────────
function LevelBadge({
  levelDef, isCurrent, size,
}: { levelDef: typeof LEVELS[0]; isCurrent: boolean; size: 'sm' | 'lg' }) {
  const scale = useRef(new Animated.Value(isCurrent ? 0.8 : 0.7)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

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
  const safeTotal = Math.max(1, total);
  const demotionCount = Math.floor(safeTotal * 0.4);
  const safetyCount = Math.floor(safeTotal * 0.35);
  const promotionCount = safeTotal - demotionCount - safetyCount;

  const demotionPct = (demotionCount / safeTotal) * 100;
  const safetyPct = (safetyCount / safeTotal) * 100;
  const promotionPct = (promotionCount / safeTotal) * 100;

  const rankPct = ((safeTotal - rank) / safeTotal) * 100; // higher rank = higher pct

  let zone: 'demotion' | 'safety' | 'promotion' = 'demotion';
  if (rankPct >= demotionPct + safetyPct) zone = 'promotion';
  else if (rankPct >= demotionPct) zone = 'safety';

  const zoneColor = zone === 'promotion' ? Colors.success : zone === 'safety' ? Colors.warning : Colors.danger;

  return (
    <View style={styles.zoneBarContainer}>
      <View style={styles.zoneLabels}>
        <Text style={[styles.zoneLabel, { color: Colors.danger }]}>Demotion zone</Text>
        <Text style={[styles.zoneLabel, { color: Colors.warning }]}>Safety zone</Text>
        <Text style={[styles.zoneLabel, { color: Colors.success }]}>Promotion zone</Text>
      </View>

      {/* Rank badge above bar */}
      <View style={[styles.rankBadgeAbove, { left: `${rankPct}%` as any, borderColor: zoneColor }]}>
        <Text style={[styles.rankBadgeAboveText, { color: zoneColor }]}>Rank: {rank}</Text>
      </View>

      {/* The bar */}
      <View style={styles.zoneBarTrack}>
        <View style={[styles.zoneSegment, { flex: demotionPct, backgroundColor: Colors.danger + '88' }]} />
        <View style={[styles.zoneSegment, { flex: safetyPct, backgroundColor: Colors.warning + '88' }]} />
        <View style={[styles.zoneSegment, { flex: promotionPct, backgroundColor: Colors.success + '88' }]} />
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
  const levelDef = LEVELS.find(l => l.rank === entry.level) ?? LEVELS[0];
  const rankColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  const rankBg = rankColors[entry.rank] ?? levelDef.color;

  return (
    <View style={[styles.boardRow, isMe && styles.boardRowMe]}>
      <View style={[styles.boardRankBadge, { backgroundColor: rankBg + '33', borderColor: rankBg }]}>
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
  const { user } = useApp();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentLevel = user ? getLevelForXP(user.xpTotal) : LEVELS[0];
  const myEntry = entries.find(e => e.id === user?.id);
  const myRank = myEntry?.rank ?? entries.length + 1;

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase.rpc('get_leaderboard');
      if (!error && data) {
        setEntries(data as LeaderboardEntry[]);
      }
    } catch (e) {
      console.log('Leaderboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, []);

  // Build carousel: show currentLevel ±2 levels
  const carouselLevels = LEVELS.filter(
    l => Math.abs(l.rank - currentLevel.rank) <= 2
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
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
              <View style={[styles.infoPill, { backgroundColor: Colors.warning + '22', borderColor: Colors.warning + '55' }]}>
                <Text style={[styles.infoPillVal, { color: Colors.warning }]}>{user?.xpTotal ?? 0}</Text>
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
          <Text style={styles.sectionTitle}>LEADERBOARD</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading rankings...</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="emoji-events" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No rankings yet.{'\n'}Complete a session to appear!</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {/* Show top 3 always, then entries around user */}
              {entries.map((entry, idx) => {
                const isMe = entry.id === user?.id;
                const isTop3 = idx < 3;
                const isNearMe = myRank > 3 && Math.abs(entry.rank - myRank) <= 3;
                // Show: top 3 always + entries near me
                if (!isTop3 && !isNearMe && !isMe) {
                  // Show separator if this is the gap
                  if (idx === 3 && myRank > 6) {
                    return (
                      <View key="sep" style={styles.separator}>
                        <Text style={styles.separatorText}>• • •</Text>
                      </View>
                    );
                  }
                  return null;
                }
                return <BoardRow key={entry.id} entry={entry} isMe={isMe} />;
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  infoPillLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  infoPillVal: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
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
    backgroundColor: Colors.surface,
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
    borderColor: Colors.surface,
  },
  zoneRankNums: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  zoneRankNum: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semiBold,
  },
  zoneRankLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  zoneRankLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Section 3 List ─────────────────────────────────────────────────────────
  listSection: {
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  listContainer: { gap: 6 },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boardRowMe: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  boardRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardRankText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extraBold,
    includeFontPadding: false,
  },
  boardName: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  boardNameMe: {
    color: Colors.primary,
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
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  xpMiniTag: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  xpMiniText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  separator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  separatorText: {
    fontSize: FontSize.base,
    color: Colors.textTertiary,
    letterSpacing: 4,
  },

  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
