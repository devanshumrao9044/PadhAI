import type { XPTransaction, UserProfile } from '../types/models.ts';
import { LEVELS } from '../constants/levels.ts';

export type WeeklyZone = 'promotion' | 'safety' | 'demotion';
export type WeeklyMarkerKind = 'baseline' | 'settlement';

export interface WeeklyMarker {
  kind: WeeklyMarkerKind;
  weekStart: string;
  zone: WeeklyZone | null;
  fromLevelRank: number;
  toLevelRank: number;
}

export interface WeeklySettlementInput {
  userId: string;
  weekStart: string;
  currentLevelRank: number;
  rank: number;
  totalPlayers: number;
}

export interface WeeklySettlementResult extends WeeklyMarker {
  markerId: string;
  xpAfterReset: 0;
}

export const WEEKLY_MARKER_PREFIX = 'weekly_xp:';

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns the local Sunday that starts the current weekly cycle. */
export function getWeekStart(date: Date = new Date()): string {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  localDate.setDate(localDate.getDate() - localDate.getDay());
  return localDateString(localDate);
}

/** Matches the leaderboard’s bottom 40% red, next 35% yellow, top 25% green model. */
export function getWeeklyZone(rank: number, totalPlayers: number): WeeklyZone {
  const safeTotal = Math.max(1, Math.floor(totalPlayers));
  const safeRank = Math.min(Math.max(1, Math.floor(rank)), safeTotal);
  const demotionCount = Math.floor(safeTotal * 0.4);
  const safetyCount = Math.floor(safeTotal * 0.35);
  const rankPct = ((safeTotal - safeRank) / safeTotal) * 100;
  const demotionPct = (demotionCount / safeTotal) * 100;
  const safetyPct = (safetyCount / safeTotal) * 100;

  if (rankPct >= demotionPct + safetyPct) return 'promotion';
  if (rankPct >= demotionPct) return 'safety';
  return 'demotion';
}

export function clampLevelRank(rank: number): number {
  return Math.min(Math.max(1, Math.floor(rank)), LEVELS.length);
}

export function getEffectiveLevelRank(user: Pick<UserProfile, 'xpTotal' | 'levelRank'>): number {
  const fallbackRank = [...LEVELS].reverse().find(level => user.xpTotal >= level.minXP)?.rank ?? 1;
  return clampLevelRank(user.levelRank ?? fallbackRank);
}

function hashToUuid(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
  const a = hex(hash);
  const b = hex(Math.imul(hash ^ 0x9e3779b9, 2246822519));
  const c = hex(Math.imul(hash ^ 0x85ebca6b, 3266489917));
  const d = hex(Math.imul(hash ^ 0xc2b2ae35, 668265263));
  return `${a}-${b.slice(0, 4)}-5${c.slice(1, 4)}-8${d.slice(1, 4)}-${d.slice(4)}${b.slice(4)}${c.slice(4)}`;
}

export function getWeeklyMarkerId(userId: string, weekStart: string): string {
  return hashToUuid(`${WEEKLY_MARKER_PREFIX}${userId}:${weekStart}`);
}

export function createWeeklyMarkerReason(marker: WeeklyMarker): string {
  return `${WEEKLY_MARKER_PREFIX}${JSON.stringify(marker)}`;
}

export function parseWeeklyMarker(transaction: Pick<XPTransaction, 'reason'>): WeeklyMarker | null {
  if (!transaction.reason.startsWith(WEEKLY_MARKER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(transaction.reason.slice(WEEKLY_MARKER_PREFIX.length)) as Partial<WeeklyMarker>;
    if (
      (parsed.kind !== 'baseline' && parsed.kind !== 'settlement') ||
      typeof parsed.weekStart !== 'string' ||
      typeof parsed.fromLevelRank !== 'number' ||
      typeof parsed.toLevelRank !== 'number'
    ) return null;
    return {
      kind: parsed.kind,
      weekStart: parsed.weekStart,
      zone: parsed.zone === 'promotion' || parsed.zone === 'safety' || parsed.zone === 'demotion' ? parsed.zone : null,
      fromLevelRank: clampLevelRank(parsed.fromLevelRank),
      toLevelRank: clampLevelRank(parsed.toLevelRank),
    };
  } catch {
    return null;
  }
}

export function getLatestWeeklyMarker(transactions: XPTransaction[]): WeeklyMarker | null {
  return transactions
    .map(transaction => ({ transaction, marker: parseWeeklyMarker(transaction) }))
    .filter((item): item is { transaction: XPTransaction; marker: WeeklyMarker } => item.marker !== null)
    .sort((a, b) => b.transaction.createdAt.localeCompare(a.transaction.createdAt))[0]?.marker ?? null;
}

export function buildBaselineMarker(userId: string, user: Pick<UserProfile, 'xpTotal' | 'levelRank'>, weekStart: string): WeeklySettlementResult {
  const levelRank = getEffectiveLevelRank(user);
  return {
    kind: 'baseline',
    weekStart,
    zone: null,
    fromLevelRank: levelRank,
    toLevelRank: levelRank,
    markerId: getWeeklyMarkerId(userId, weekStart),
    xpAfterReset: 0,
  };
}

export function buildWeeklySettlement(input: WeeklySettlementInput): WeeklySettlementResult {
  const fromLevelRank = clampLevelRank(input.currentLevelRank);
  const zone = getWeeklyZone(input.rank, input.totalPlayers);
  const toLevelRank = zone === 'promotion'
    ? clampLevelRank(fromLevelRank + 1)
    : zone === 'demotion'
      ? clampLevelRank(fromLevelRank - 1)
      : fromLevelRank;
  return {
    kind: 'settlement',
    weekStart: input.weekStart,
    zone,
    fromLevelRank,
    toLevelRank,
    markerId: getWeeklyMarkerId(input.userId, input.weekStart),
    xpAfterReset: 0,
  };
}
