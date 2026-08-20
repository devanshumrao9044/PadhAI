export const STREAK_RECOVERY_MINUTES = 30;

export function isStreakRecoveryEligible(isRecoverySession: boolean, actualMinutes: number): boolean {
  if (!isRecoverySession) return true;
  return Number.isFinite(actualMinutes) && actualMinutes >= STREAK_RECOVERY_MINUTES;
}

export function getRecoveredStreak(lostStreak: number): number {
  return Math.max(1, Math.ceil(Math.max(0, lostStreak) / 2));
}
