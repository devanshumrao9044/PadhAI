import type { FocusSession } from '@/types/models';

/**
 * Returns the latest unique sessions for compact history cards.
 * The full session list remains available to analytics; this helper only
 * controls the number and ordering of rows shown in Profile.
 */
export function getRecentSessions(
  sessions: readonly FocusSession[],
  limit = 3,
): FocusSession[] {
  if (limit <= 0 || sessions.length === 0) return [];

  const unique = new Map<string, FocusSession>();
  for (const session of sessions) {
    const existing = unique.get(session.id);
    if (!existing || Date.parse(session.createdAt) > Date.parse(existing.createdAt)) {
      unique.set(session.id, session);
    }
  }

  const timestamp = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return [...unique.values()]
    .sort((a, b) => {
      const timeDifference = timestamp(b.createdAt) - timestamp(a.createdAt);
      if (timeDifference !== 0) return timeDifference;
      return b.id.localeCompare(a.id);
    })
    .slice(0, limit);
}
