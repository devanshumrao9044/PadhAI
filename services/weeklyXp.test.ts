import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBaselineMarker,
  buildWeeklySettlement,
  getLatestWeeklyMarker,
  getWeekStart,
  getWeeklyMarkerId,
  getWeeklyZone,
  parseWeeklyMarker,
  createWeeklyMarkerReason,
} from './weeklyXp.ts';

const userId = '00000000-0000-4000-8000-000000000001';

function user(levelRank?: number, xpTotal = 0) {
  return { id: userId, xpTotal, levelRank };
}

test('week starts on the local Sunday and remains stable within that week', () => {
  assert.equal(getWeekStart(new Date(2026, 7, 16, 12)), '2026-08-16');
  assert.equal(getWeekStart(new Date(2026, 7, 19, 12)), '2026-08-16');
  assert.equal(getWeekStart(new Date(2026, 7, 15, 12)), '2026-08-09');
});

test('leaderboard zones match the 40% red, 35% yellow, 25% green bands', () => {
  assert.equal(getWeeklyZone(10, 10), 'demotion');
  assert.equal(getWeeklyZone(5, 10), 'safety');
  assert.equal(getWeeklyZone(1, 10), 'promotion');
});

test('green promotes, yellow holds, and red demotes one level', () => {
  assert.equal(buildWeeklySettlement({ userId, weekStart: '2026-08-16', currentLevelRank: 2, rank: 1, totalPlayers: 10 }).toLevelRank, 3);
  assert.equal(buildWeeklySettlement({ userId, weekStart: '2026-08-16', currentLevelRank: 2, rank: 5, totalPlayers: 10 }).toLevelRank, 2);
  assert.equal(buildWeeklySettlement({ userId, weekStart: '2026-08-16', currentLevelRank: 2, rank: 10, totalPlayers: 10 }).toLevelRank, 1);
  assert.equal(buildWeeklySettlement({ userId, weekStart: '2026-08-16', currentLevelRank: 5, rank: 1, totalPlayers: 10 }).toLevelRank, 5);
  assert.equal(buildWeeklySettlement({ userId, weekStart: '2026-08-16', currentLevelRank: 1, rank: 10, totalPlayers: 10 }).toLevelRank, 1);
});

test('baseline marker preserves legacy XP-derived level and resets weekly XP to zero', () => {
  const marker = buildBaselineMarker(userId, user(undefined, 521), '2026-08-09');
  assert.equal(marker.kind, 'baseline');
  assert.equal(marker.toLevelRank, 3);
  assert.equal(marker.xpAfterReset, 0);
  assert.equal(marker.markerId, getWeeklyMarkerId(userId, '2026-08-09'));
  assert.match(marker.markerId, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('marker serialization and latest-marker lookup are deterministic', () => {
  const marker = buildWeeklySettlement({ userId, weekStart: '2026-08-16', currentLevelRank: 3, rank: 1, totalPlayers: 10 });
  const transaction = {
    id: marker.markerId,
    userId,
    amount: 0,
    reason: createWeeklyMarkerReason(marker),
    createdAt: '2026-08-16T00:00:00.000Z',
  };
  assert.deepEqual(parseWeeklyMarker(transaction), {
    kind: marker.kind,
    weekStart: marker.weekStart,
    zone: marker.zone,
    fromLevelRank: marker.fromLevelRank,
    toLevelRank: marker.toLevelRank,
  });
  assert.deepEqual(getLatestWeeklyMarker([transaction]), parseWeeklyMarker(transaction));
  assert.equal(getWeeklyMarkerId(userId, '2026-08-16'), marker.markerId);
  assert.equal(parseWeeklyMarker({ reason: 'session_complete' }), null);
});
