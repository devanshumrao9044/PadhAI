import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChapterAnalyticsViewModel,
  filterChapterAnalyticsByActiveChapterIds,
  formatChapterAnalyticsMinutes,
} from '../../services/chapterAnalytics.ts';
import type { ChapterAnalytics } from '../../types/models.ts';

const makeAnalytics = (overrides: Partial<ChapterAnalytics> = {}): ChapterAnalytics => ({
  chapterId: 'chapter-1',
  subjectId: 'subject-1',
  chapterName: 'Kinetics',
  chapterStatus: 'weak',
  totalSessions: 2,
  completedSessions: 1,
  brokenSessions: 1,
  totalMinutes: 61,
  plannedMinutes: 90,
  xpEarned: 10,
  xpDeducted: 2,
  averageSessionMinutes: 30.5,
  firstSessionAt: null,
  lastSessionAt: null,
  ...overrides,
});

test('ChapterAnalyticsCard formats minutes and session metadata for display', () => {
  const [row] = buildChapterAnalyticsViewModel([makeAnalytics()]);

  assert.equal(row.minutesLabel, '1h 1m');
  assert.equal(row.sessionLabel, '2 sessions · 1 completed');
  assert.equal(row.progressPercent, 100);
});

test('ChapterAnalyticsCard scales progress relative to the largest visible chapter', () => {
  const rows = buildChapterAnalyticsViewModel([
    makeAnalytics({ chapterId: 'chapter-1', totalMinutes: 120 }),
    makeAnalytics({ chapterId: 'chapter-2', totalMinutes: 60 }),
    makeAnalytics({ chapterId: 'chapter-3', totalMinutes: 0 }),
  ]);

  assert.deepEqual(rows.map(row => row.progressPercent), [100, 50, 0]);
  assert.equal(rows[2].minutesLabel, '0m');
});

test('ChapterAnalyticsCard limits the dashboard list to five chapters', () => {
  const analytics = Array.from({ length: 7 }, (_, index) => makeAnalytics({
    chapterId: `chapter-${index}`,
    chapterName: `Chapter ${index}`,
    totalMinutes: index + 1,
  }));

  assert.equal(buildChapterAnalyticsViewModel(analytics).length, 5);
});

test('ChapterAnalyticsCard filters analytics to active tracker chapters', () => {
  const visible = filterChapterAnalyticsByActiveChapterIds([
    makeAnalytics({ chapterId: 'active' }),
    makeAnalytics({ chapterId: 'deleted' }),
  ], new Set(['active']));

  assert.deepEqual(visible.map(row => row.chapterId), ['active']);
});

test('ChapterAnalyticsCard produces an empty state model when no chapters exist', () => {
  assert.deepEqual(buildChapterAnalyticsViewModel([]), []);
});

test('ChapterAnalyticsCard minute formatting handles minute and hour boundaries', () => {
  assert.equal(formatChapterAnalyticsMinutes(0), '0m');
  assert.equal(formatChapterAnalyticsMinutes(59), '59m');
  assert.equal(formatChapterAnalyticsMinutes(60), '1h');
  assert.equal(formatChapterAnalyticsMinutes(125), '2h 5m');
});
