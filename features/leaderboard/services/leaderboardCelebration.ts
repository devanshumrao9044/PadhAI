export type TopThreeRank = number | null;

export type TopThreeCelebrationState = {
  rank: TopThreeRank;
  updatedAt: number;
};

export type TopThreeRankTransition = {
  previousRank: TopThreeRank;
  currentRank: TopThreeRank;
  wasInTopThree: boolean;
  isInTopThree: boolean;
  shouldCelebrate: boolean;
};

export type PersistTopThreeState = (
  state: TopThreeCelebrationState,
) => void | Promise<void>;

export type CelebrateTopThree = (rank: number) => void;

function normalizeRank(rank: number | null | undefined): TopThreeRank {
  return typeof rank === 'number' && Number.isInteger(rank) && rank >= 1
    ? rank
    : null;
}

export function isTopThreeRank(rank: number | null | undefined): rank is number {
  return normalizeRank(rank) !== null && (rank as number) <= 3;
}

export function getTopThreeRankTransition(
  previousRank: number | null | undefined,
  currentRank: number | null | undefined,
): TopThreeRankTransition {
  const normalizedPreviousRank = normalizeRank(previousRank);
  const normalizedCurrentRank = normalizeRank(currentRank);
  const wasInTopThree = isTopThreeRank(normalizedPreviousRank);
  const isInTopThree = isTopThreeRank(normalizedCurrentRank);

  return {
    previousRank: normalizedPreviousRank,
    currentRank: normalizedCurrentRank,
    wasInTopThree,
    isInTopThree,
    shouldCelebrate: isInTopThree && !wasInTopThree,
  };
}

/**
 * Applies one leaderboard update. The callback is the animation boundary used
 * by the screen, while persistence keeps the celebration from replaying.
 */
export async function applyTopThreeRankUpdate({
  previousRank,
  currentRank,
  persist,
  onCelebrate,
  now = Date.now,
}: {
  previousRank: number | null | undefined;
  currentRank: number | null | undefined;
  persist?: PersistTopThreeState;
  onCelebrate?: CelebrateTopThree;
  now?: () => number;
}): Promise<TopThreeRankTransition> {
  const transition = getTopThreeRankTransition(previousRank, currentRank);

  if (persist && transition.previousRank !== transition.currentRank) {
    await persist({ rank: transition.currentRank, updatedAt: now() });
  }

  if (transition.shouldCelebrate && onCelebrate && transition.currentRank !== null) {
    onCelebrate(transition.currentRank);
  }

  return transition;
}
