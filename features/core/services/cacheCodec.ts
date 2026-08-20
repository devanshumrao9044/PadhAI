import LZString from 'lz-string';

const { compressToUTF16, decompressFromUTF16 } = LZString;

export const CACHE_VERSION = 1;
export const CACHE_PREFIX = 'padhai:cache:v1';

export type CacheKind =
  | 'user'
  | 'subjects'
  | 'chapters'
  | 'topics'
  | 'sessions'
  | 'dailySummaries'
  | 'xpLog'
  | 'chapterAnalytics'
  | 'referralMeta'
  | 'leaderboard'
  | 'todo'
  | 'calendar'
  | 'subjectTimers'
  | 'notificationSettings';

export const CACHE_TTL_MS: Record<CacheKind, number> = {
  user: 5 * 60 * 1000,
  subjects: 5 * 60 * 1000,
  chapters: 5 * 60 * 1000,
  topics: 5 * 60 * 1000,
  sessions: 60 * 1000,
  dailySummaries: 5 * 60 * 1000,
  xpLog: 5 * 60 * 1000,
  chapterAnalytics: 60 * 1000,
  referralMeta: 5 * 60 * 1000,
  leaderboard: 30 * 1000,
  todo: 60 * 1000,
  calendar: 60 * 1000,
  subjectTimers: 5 * 1000,
  notificationSettings: 30 * 24 * 60 * 60 * 1000,
};

type CacheEnvelope<T> = {
  version: number;
  userId: string;
  storedAt: number;
  data: T;
};

export type CachedValue<T> = {
  data: T;
  storedAt: number;
  isFresh: boolean;
};

export function cacheKey(userId: string, kind: CacheKind): string {
  return `${CACHE_PREFIX}:${userId}:${kind}`;
}

export function encodeCache<T>(envelope: CacheEnvelope<T>): string {
  return compressToUTF16(JSON.stringify(envelope));
}

export function decodeCache<T>(compressed: string): CacheEnvelope<T> | null {
  try {
    const json = decompressFromUTF16(compressed);
    if (!json) return null;
    const envelope = JSON.parse(json) as CacheEnvelope<T>;
    if (
      !envelope ||
      envelope.version !== CACHE_VERSION ||
      typeof envelope.userId !== 'string' ||
      typeof envelope.storedAt !== 'number' ||
      !('data' in envelope)
    ) {
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}
