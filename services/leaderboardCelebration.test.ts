import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTopThreeRankUpdate,
  getTopThreeRankTransition,
  isTopThreeRank,
  type TopThreeCelebrationState,
} from './leaderboardCelebration.ts';

test('top-three rank predicate accepts only integer ranks 1 through 3', () => {
  assert.equal(isTopThreeRank(1), true);
  assert.equal(isTopThreeRank(3), true);
  assert.equal(isTopThreeRank(4), false);
  assert.equal(isTopThreeRank(0), false);
  assert.equal(isTopThreeRank(1.5), false);
  assert.equal(isTopThreeRank(null), false);
  assert.equal(isTopThreeRank(undefined), false);
});

test('rank transition celebrates entry from outside top three only', () => {
  assert.deepEqual(getTopThreeRankTransition(4, 2), {
    previousRank: 4,
    currentRank: 2,
    wasInTopThree: false,
    isInTopThree: true,
    shouldCelebrate: true,
  });

  assert.equal(getTopThreeRankTransition(null, 1).shouldCelebrate, true);
  assert.equal(getTopThreeRankTransition(3, 1).shouldCelebrate, false);
  assert.equal(getTopThreeRankTransition(2, 3).shouldCelebrate, false);
  assert.equal(getTopThreeRankTransition(1, 4).shouldCelebrate, false);
});

test('rank transition normalizes malformed ranks before making a decision', () => {
  const transition = getTopThreeRankTransition('3' as unknown as number, Number.NaN);

  assert.deepEqual(transition, {
    previousRank: null,
    currentRank: null,
    wasInTopThree: false,
    isInTopThree: false,
    shouldCelebrate: false,
  });
});

test('applyTopThreeRankUpdate persists rank changes and invokes the animation callback only on entry', async () => {
  const persisted: TopThreeCelebrationState[] = [];
  const celebrated: number[] = [];

  const firstTransition = await applyTopThreeRankUpdate({
    previousRank: 5,
    currentRank: 2,
    persist: (state: TopThreeCelebrationState) => { persisted.push(state); },
    onCelebrate: rank => { celebrated.push(rank); },
    now: () => 1234,
  });

  assert.equal(firstTransition.shouldCelebrate, true);
  assert.deepEqual([...persisted], [{ rank: 2, updatedAt: 1234 }]);
  assert.deepEqual([...celebrated], [2]);

  const secondTransition = await applyTopThreeRankUpdate({
    previousRank: 2,
    currentRank: 1,
    persist: (state: TopThreeCelebrationState) => { persisted.push(state); },
    onCelebrate: rank => { celebrated.push(rank); },
    now: () => 5678,
  });

  assert.equal(secondTransition.shouldCelebrate, false);
  assert.deepEqual([...persisted], [
    { rank: 2, updatedAt: 1234 },
    { rank: 1, updatedAt: 5678 },
  ]);
  assert.deepEqual([...celebrated], [2]);
});
