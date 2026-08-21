import type { FocusSession, XPTransaction } from '@/types/models';

function createdAtValue(value: string | null | undefined): number {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Merge cloud and local records by id. Local records are deliberately retained
 * when a cloud request has not reflected a just-completed/offline session yet.
 */
export function mergeFocusSessions(
  cloudSessions: FocusSession[],
  localSessions: FocusSession[],
  limit = 200,
): FocusSession[] {
  const byId = new Map<string, FocusSession>();
  for (const session of [...cloudSessions, ...localSessions]) {
    if (!session?.id) continue;
    const previous = byId.get(session.id);
    if (!previous || createdAtValue(session.createdAt) >= createdAtValue(previous.createdAt)) {
      byId.set(session.id, session);
    }
  }
  return [...byId.values()]
    .sort((a, b) => createdAtValue(b.createdAt) - createdAtValue(a.createdAt))
    .slice(0, Math.max(1, limit));
}

/** Keep local XP transactions that are queued or not yet visible in Supabase. */
export function mergeXPTransactions(
  cloudTransactions: XPTransaction[],
  localTransactions: XPTransaction[],
  limit = 50,
): XPTransaction[] {
  const byId = new Map<string, XPTransaction>();
  for (const transaction of [...cloudTransactions, ...localTransactions]) {
    if (!transaction?.id) continue;
    const previous = byId.get(transaction.id);
    if (!previous || createdAtValue(transaction.createdAt) >= createdAtValue(previous.createdAt)) {
      byId.set(transaction.id, transaction);
    }
  }
  return [...byId.values()]
    .sort((a, b) => createdAtValue(b.createdAt) - createdAtValue(a.createdAt))
    .slice(0, Math.max(1, limit));
}

export function getFocusSessionLabel(
  session: Pick<FocusSession, 'subjectId' | 'chapterId'>,
): 'general' | 'linked' {
  return session.subjectId || session.chapterId ? 'linked' : 'general';
}

export function calculateCompletedSessionXP(actualMinutes: number, comebackBonus = 0): number {
  const safeMinutes = Number.isFinite(actualMinutes) ? Math.max(0, Math.floor(actualMinutes)) : 0;
  const safeBonus = comebackBonus === 50 ? 50 : 0;
  return Math.floor((safeMinutes / 5) * 10) + safeBonus;
}
