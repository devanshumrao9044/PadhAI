import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTopThreeRankUpdate,
  type TopThreeCelebrationState,
} from './leaderboardCelebration.ts';

class FakeAsyncStorage {
  private readonly values = new Map<string, string>();

  async getItem<T>(key: string): Promise<T | null> {
    const value = this.values.get(key);
    return value ? JSON.parse(value) as T : null;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }
}

async function applyLiveRank(
  storage: FakeAsyncStorage,
  key: string,
  currentRank: number | null,
  onCelebrate: (rank: number) => void,
) {
  const previousState = await storage.getItem<TopThreeCelebrationState>(key);
  return applyTopThreeRankUpdate({
    previousRank: previousState?.rank ?? null,
    currentRank,
    persist: state => storage.setItem(key, state),
    onCelebrate,
    now: () => 20260817,
  });
}

test('live leaderboard integration celebrates first entry, ignores top-three reordering, and re-celebrates after exit and re-entry', async () => {
  const storage = new FakeAsyncStorage();
  const key = 'padhai_top_three_celebration_v1_user-1_level_1';
  const animationRanks: number[] = [];

  await applyLiveRank(storage, key, 5, rank => animationRanks.push(rank));
  await applyLiveRank(storage, key, 3, rank => animationRanks.push(rank));
  await applyLiveRank(storage, key, 2, rank => animationRanks.push(rank));
  await applyLiveRank(storage, key, 4, rank => animationRanks.push(rank));
  await applyLiveRank(storage, key, 1, rank => animationRanks.push(rank));

  assert.deepEqual(animationRanks, [3, 1]);
  assert.deepEqual(await storage.getItem<TopThreeCelebrationState>(key), {
    rank: 1,
    updatedAt: 20260817,
  });
});

test('separate user and level keys isolate celebration state', async () => {
  const storage = new FakeAsyncStorage();
  const userOneLevelOne = 'padhai_top_three_celebration_v1_user-1_level_1';
  const userOneLevelTwo = 'padhai_top_three_celebration_v1_user-1_level_2';
  const userTwoLevelOne = 'padhai_top_three_celebration_v1_user-2_level_1';
  const animationRanks: string[] = [];

  await applyLiveRank(storage, userOneLevelOne, 2, rank => animationRanks.push(`u1-l1:${rank}`));
  await applyLiveRank(storage, userOneLevelTwo, 1, rank => animationRanks.push(`u1-l2:${rank}`));
  await applyLiveRank(storage, userTwoLevelOne, 3, rank => animationRanks.push(`u2-l1:${rank}`));
  await applyLiveRank(storage, userOneLevelOne, 1, rank => animationRanks.push(`u1-l1:${rank}`));

  assert.deepEqual(animationRanks, ['u1-l1:2', 'u1-l2:1', 'u2-l1:3']);
});
