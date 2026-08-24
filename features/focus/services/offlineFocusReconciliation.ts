export type FocusProgressSnapshot = {
  xpTotal: number;
  streakCurrent: number;
  streakLongest: number;
};

type FocusSyncProgressResult = {
  status: 'accepted' | 'duplicate' | 'conflict' | 'failed';
  newXpTotal?: number;
  newStreak?: number;
};

/** Apply only authoritative totals returned by sync_offline_focus_session. */
export function reconcileOfflineFocusProgress<T extends FocusProgressSnapshot>(
  user: T,
  result: FocusSyncProgressResult,
): T {
  if (result.status !== 'accepted' && result.status !== 'duplicate') return user;
  const xpTotal = Number(result.newXpTotal);
  const streakCurrent = Number(result.newStreak);
  if (!Number.isFinite(xpTotal) && !Number.isFinite(streakCurrent)) return user;
  return {
    ...user,
    ...(Number.isFinite(xpTotal) ? { xpTotal: Math.max(0, xpTotal) } : {}),
    ...(Number.isFinite(streakCurrent)
      ? {
          streakCurrent: Math.max(0, streakCurrent),
          streakLongest: Math.max(user.streakLongest, streakCurrent),
        }
      : {}),
  };
}
