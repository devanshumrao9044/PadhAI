import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeChapterAnalyticsRows } from '../features/analytics/services/chapterAnalytics.ts';

const rpcRow = (overrides: Record<string, unknown> = {}) => ({
  chapter_id: 'chapter-1',
  subject_id: 'subject-1',
  chapter_name: 'Kinetics',
  chapter_status: 'weak',
  total_sessions: '3',
  completed_sessions: '2',
  broken_sessions: '1',
  total_minutes: '90',
  planned_minutes: '120',
  xp_earned: '20',
  xp_deducted: '4',
  average_session_minutes: '30.00',
  first_session_at: '2026-08-16T08:00:00.000Z',
  last_session_at: '2026-08-16T09:30:00.000Z',
  ...overrides,
});

test('AppContext chapter analytics hydration maps Supabase RPC rows into typed state', () => {
  const [chapter] = normalizeChapterAnalyticsRows([rpcRow()]);

  assert.deepEqual(chapter, {
    chapterId: 'chapter-1',
    subjectId: 'subject-1',
    chapterName: 'Kinetics',
    chapterStatus: 'weak',
    totalSessions: 3,
    completedSessions: 2,
    brokenSessions: 1,
    totalMinutes: 90,
    plannedMinutes: 120,
    xpEarned: 20,
    xpDeducted: 4,
    averageSessionMinutes: 30,
    firstSessionAt: '2026-08-16T08:00:00.000Z',
    lastSessionAt: '2026-08-16T09:30:00.000Z',
  });
});

test('AppContext chapter analytics hydration preserves zeroes and nullable fields', () => {
  const [chapter] = normalizeChapterAnalyticsRows([rpcRow({
    subject_id: null,
    total_sessions: 0,
    completed_sessions: 0,
    broken_sessions: 0,
    total_minutes: 0,
    planned_minutes: 0,
    xp_earned: 0,
    xp_deducted: 0,
    average_session_minutes: null,
    first_session_at: null,
    last_session_at: null,
  })]);

  assert.equal(chapter.subjectId, null);
  assert.equal(chapter.totalMinutes, 0);
  assert.equal(chapter.averageSessionMinutes, null);
  assert.equal(chapter.firstSessionAt, null);
  assert.equal(chapter.lastSessionAt, null);
});

test('AppContext chapter analytics hydration ignores malformed rows and non-array responses', () => {
  const hydrated = normalizeChapterAnalyticsRows([
    rpcRow(),
    { chapter_id: null, chapter_name: 'Missing ID' },
    { chapter_id: 'chapter-2', chapter_name: null },
    null,
    'invalid-row',
  ]);

  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0].chapterId, 'chapter-1');
  assert.deepEqual(normalizeChapterAnalyticsRows(null), []);
  assert.deepEqual(normalizeChapterAnalyticsRows({ data: [] }), []);
});

test('AppContext chapter analytics hydration normalizes non-finite numeric values to zero', () => {
  const [chapter] = normalizeChapterAnalyticsRows([rpcRow({
    total_sessions: 'not-a-number',
    total_minutes: Number.NaN,
    xp_earned: Infinity,
  })]);

  assert.equal(chapter.totalSessions, 0);
  assert.equal(chapter.totalMinutes, 0);
  assert.equal(chapter.xpEarned, 0);
});
