import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileOfflineFocusProgress } from './offlineFocusReconciliation.ts';

const user = {
  id: 'user-1',
  xpTotal: 20,
  streakCurrent: 2,
  streakLongest: 4,
};

test('accepted sync applies server XP and streak totals without client arithmetic', () => {
  const next = reconcileOfflineFocusProgress(user, {
    status: 'accepted',
    newXpTotal: 68,
    newStreak: 3,
  });

  assert.deepEqual(next, {
    ...user,
    xpTotal: 68,
    streakCurrent: 3,
    streakLongest: 4,
  });
});

test('accepted sync raises longest streak when the server returns a new record', () => {
  const next = reconcileOfflineFocusProgress(user, {
    status: 'accepted',
    newXpTotal: 120,
    newStreak: 7,
  });

  assert.equal(next.xpTotal, 120);
  assert.equal(next.streakCurrent, 7);
  assert.equal(next.streakLongest, 7);
});

test('duplicate sync with authoritative totals reconciles but never adds XP twice', () => {
  const next = reconcileOfflineFocusProgress(user, {
    status: 'duplicate',
    newXpTotal: 20,
    newStreak: 2,
  });

  assert.equal(next.xpTotal, 20);
  assert.equal(next.streakCurrent, 2);
  assert.equal(next.streakLongest, 4);
});

test('conflict, failed, and missing totals leave local progression unchanged', () => {
  assert.strictEqual(
    reconcileOfflineFocusProgress(user, { status: 'conflict', newXpTotal: 999, newStreak: 99 }),
    user,
  );
  assert.strictEqual(
    reconcileOfflineFocusProgress(user, { status: 'failed', newXpTotal: 999, newStreak: 99 }),
    user,
  );
  assert.strictEqual(
    reconcileOfflineFocusProgress(user, { status: 'accepted' }),
    user,
  );
});
