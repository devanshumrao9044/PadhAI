import { getItem, removeItem, setItem } from './storage.ts';
import {
  CACHE_TTL_MS,
  cacheKey,
  decodeCache,
  encodeCache,
  type CacheKind,
  type CachedValue,
} from './cacheCodec.ts';

export type { CacheKind, CachedValue } from './cacheCodec.ts';
export { CACHE_TTL_MS } from './cacheCodec.ts';

export async function readUserCache<T>(userId: string, kind: CacheKind): Promise<CachedValue<T> | null> {
  const compressed = await getItem<string>(cacheKey(userId, kind));
  if (!compressed) return null;
  const envelope = decodeCache<T>(compressed);
  if (!envelope || envelope.userId !== userId) {
    await removeItem(cacheKey(userId, kind));
    return null;
  }
  return {
    data: envelope.data,
    storedAt: envelope.storedAt,
    isFresh: Date.now() - envelope.storedAt <= CACHE_TTL_MS[kind],
  };
}

export async function writeUserCache<T>(userId: string, kind: CacheKind, data: T): Promise<void> {
  await setItem(cacheKey(userId, kind), encodeCache({
    version: 1,
    userId,
    storedAt: Date.now(),
    data,
  }));
}

export async function removeUserCache(userId: string): Promise<void> {
  await Promise.all(
    (Object.keys(CACHE_TTL_MS) as CacheKind[]).map(kind => removeItem(cacheKey(userId, kind))),
  );
}

export function getCacheKeyForTesting(userId: string, kind: CacheKind): string {
  return cacheKey(userId, kind);
}
