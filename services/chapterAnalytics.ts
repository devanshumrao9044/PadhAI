import type { ChapterAnalytics } from '../types/models';

export type ChapterAnalyticsRpcRow = {
  chapter_id?: string | null;
  subject_id?: string | null;
  chapter_name?: string | null;
  chapter_status?: ChapterAnalytics['chapterStatus'] | null;
  total_sessions?: number | string | null;
  completed_sessions?: number | string | null;
  broken_sessions?: number | string | null;
  total_minutes?: number | string | null;
  planned_minutes?: number | string | null;
  xp_earned?: number | string | null;
  xp_deducted?: number | string | null;
  average_session_minutes?: number | string | null;
  first_session_at?: string | null;
  last_session_at?: string | null;
};

export type ChapterAnalyticsViewModel = {
  analytics: ChapterAnalytics;
  progressPercent: number;
  minutesLabel: string;
  sessionLabel: string;
};

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function mapChapterAnalyticsRow(row: unknown): ChapterAnalytics | null {
  if (!row || typeof row !== 'object') return null;
  const candidate = row as ChapterAnalyticsRpcRow;
  if (!candidate.chapter_id || !candidate.chapter_name) return null;
  return {
    chapterId: candidate.chapter_id,
    subjectId: candidate.subject_id ?? null,
    chapterName: candidate.chapter_name,
    chapterStatus: candidate.chapter_status ?? 'not_started',
    totalSessions: toNumber(candidate.total_sessions),
    completedSessions: toNumber(candidate.completed_sessions),
    brokenSessions: toNumber(candidate.broken_sessions),
    totalMinutes: toNumber(candidate.total_minutes),
    plannedMinutes: toNumber(candidate.planned_minutes),
    xpEarned: toNumber(candidate.xp_earned),
    xpDeducted: toNumber(candidate.xp_deducted),
    averageSessionMinutes: candidate.average_session_minutes === null || candidate.average_session_minutes === undefined
      ? null
      : toNumber(candidate.average_session_minutes),
    firstSessionAt: candidate.first_session_at ?? null,
    lastSessionAt: candidate.last_session_at ?? null,
  };
}

export function normalizeChapterAnalyticsRows(rows: unknown): ChapterAnalytics[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => mapChapterAnalyticsRow(row))
    .filter((row): row is ChapterAnalytics => row !== null);
}

export function formatChapterAnalyticsMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function buildChapterAnalyticsViewModel(
  analytics: ChapterAnalytics[],
  limit = 5,
): ChapterAnalyticsViewModel[] {
  const visibleRows = analytics.slice(0, limit);
  const maxMinutes = Math.max(1, ...visibleRows.map(row => row.totalMinutes));
  return visibleRows.map(row => ({
    analytics: row,
    progressPercent: row.totalMinutes > 0
      ? Math.max(5, (row.totalMinutes / maxMinutes) * 100)
      : 0,
    minutesLabel: formatChapterAnalyticsMinutes(row.totalMinutes),
    sessionLabel: `${row.totalSessions} ${row.totalSessions === 1 ? 'session' : 'sessions'} · ${row.completedSessions} completed`,
  }));
}
