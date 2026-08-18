import assert from 'node:assert/strict';
import test from 'node:test';
import { getRecoveredStreak, isStreakRecoveryEligible, STREAK_RECOVERY_MINUTES } from './streakRecovery.ts';

test('recovery policy requires the full 30 minutes', () => {
  assert.equal(STREAK_RECOVERY_MINUTES, 30);
  assert.equal(isStreakRecoveryEligible(true, 1), false);
  assert.equal(isStreakRecoveryEligible(true, 29), false);
  assert.equal(isStreakRecoveryEligible(true, 30), true);
});

test('normal sessions are not blocked by recovery policy', () => {
  assert.equal(isStreakRecoveryEligible(false, 1), true);
});

test('recovered streak is exactly half rounded up with a minimum of one', () => {
  assert.equal(getRecoveredStreak(0), 1);
  assert.equal(getRecoveredStreak(1), 1);
  assert.equal(getRecoveredStreak(3), 2);
  assert.equal(getRecoveredStreak(4), 2);
});
