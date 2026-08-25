import type { UserProfile } from '../../../types/models';

type UserRow = Record<string, unknown>;

const hasOwn = (row: UserRow, key: string): boolean => Object.prototype.hasOwnProperty.call(row, key);

const readString = (value: unknown, fallback: string): string => (
  typeof value === 'string' && value.length > 0 ? value : fallback
);

const readNumber = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const readNullableString = (value: unknown, fallback: string | null): string | null => {
  if (value === null) return null;
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

export const mapUser = (
  row: UserRow,
  previous: UserProfile | null = null,
  authEmail?: string | null,
): UserProfile => {
  const email = typeof row.email === 'string' ? row.email : authEmail;
  const mappedUsername = email?.split('@')[0] || 'student';
  const targetExam = readString(row.target_exam, previous?.targetExam ?? 'OTHER') as UserProfile['targetExam'];
  const classLevel = readString(row.class, previous?.classLevel ?? 'SELF_STUDY') as UserProfile['classLevel'];

  return {
    id: String(row.id),
    username: previous?.username ?? mappedUsername,
    fullName: readString(row.name, previous?.fullName ?? 'Student'),
    targetExam,
    classLevel,
    dailyGoalMinutes: readNumber(row.daily_goal_minutes, previous?.dailyGoalMinutes ?? 120),
    xpTotal: readNumber(row.xp, previous?.xpTotal ?? 0),
    levelRank: hasOwn(row, 'level_rank')
      ? readNumber(row.level_rank, previous?.levelRank ?? 1)
      : previous?.levelRank,
    streakCurrent: readNumber(row.streak, previous?.streakCurrent ?? 0),
    streakLongest: readNumber(row.longest_streak, previous?.streakLongest ?? 0),
    lastStudyDate: readNullableString(row.last_study_date, previous?.lastStudyDate ?? null),
    createdAt: readString(row.created_at, previous?.createdAt ?? new Date().toISOString()),
    avatarUrl: hasOwn(row, 'avatar_url') ? readNullableString(row.avatar_url, null) : (previous?.avatarUrl ?? null),
    myReferralCode: hasOwn(row, 'my_referral_code') ? readNullableString(row.my_referral_code, null) : (previous?.myReferralCode ?? null),
    referredBy: previous?.referredBy,
    hasUnlockedReward: hasOwn(row, 'has_unlocked_reward')
      ? row.has_unlocked_reward === true
      : (previous?.hasUnlockedReward ?? false),
  };
};

/**
 * Realtime UPDATE payloads must contain the authoritative progression columns.
 * Missing rows/columns are ignored instead of defaulting XP or streak to zero.
 */
export const applyAuthoritativeUserRow = (
  rowValue: unknown,
  previous: UserProfile | null,
  authEmail?: string | null,
): UserProfile | null => {
  if (!rowValue || typeof rowValue !== 'object') return null;
  const row = rowValue as UserRow;
  if (typeof row.id !== 'string' || !hasOwn(row, 'xp') || !hasOwn(row, 'streak')) return null;
  if (previous && previous.id !== row.id) return null;
  return mapUser(row, previous, authEmail);
};
