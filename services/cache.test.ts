import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_TTL_MS,
  cacheKey,
  decodeCache,
  encodeCache,
} from './cacheCodec.ts';

test('compressed cache codec round-trips Unicode data', () => {
  const envelope = {
    version: 1,
    userId: 'user-a',
    storedAt: Date.now(),
    data: [{ name: 'Physics — गति', nested: { done: true } }],
  };
  const encoded = encodeCache(envelope);
  const decoded = decodeCache<typeof envelope.data>(encoded);
  assert.deepEqual(decoded, envelope);
});

test('cache keys are user-scoped and TTLs distinguish volatile data', () => {
  assert.notEqual(cacheKey('user-a', 'sessions'), cacheKey('user-b', 'sessions'));
  assert.notEqual(cacheKey('user-a', 'leaderboard'), cacheKey('user-b', 'leaderboard'));
  assert.equal(CACHE_TTL_MS.leaderboard, 30 * 1000);
  assert.ok(CACHE_TTL_MS.sessions < CACHE_TTL_MS.subjects);
});

test('leaderboard cache payload preserves level and rank data through compression', () => {
  const envelope = {
    version: 1,
    userId: 'user-a',
    storedAt: Date.now(),
    data: {
      level: 2,
      entries: [{ id: 'student-a', name: 'Student A', xp: 120, level: 2, streak: 3, rank: 1 }],
    },
  };
  const decoded = decodeCache<typeof envelope.data>(encodeCache(envelope));
  assert.deepEqual(decoded, envelope);
});

test('corrupt compressed payloads are rejected', () => {
  assert.equal(decodeCache('not-valid-compressed-data'), null);
  assert.equal(decodeCache(''), null);
});
