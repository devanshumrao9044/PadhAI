import assert from 'node:assert/strict';
import test from 'node:test';
import { getRecentSessions } from './sessionHistory.ts';
import type { FocusSession } from '@/types/models';

const session = (id: string, createdAt: string): FocusSession => ({
  id,
  userId: 'user-1',
  subjectId: null,
  chapterId: null,
  durationPlannedMins: 25,
  durationActualMins: 25,
  completed: true,
  xpEarned: 10,
  xpDeducted: 0,
  brokenAtPercent: 100,
  sessionDate: createdAt.slice(0, 10),
  createdAt,
});

test('returns exactly the latest three unique sessions', () => {
  const sessions = [
    session('old', '2026-08-10T10:00:00.000Z'),
    session('latest', '2026-08-16T10:00:00.000Z'),
    session('middle', '2026-08-14T10:00:00.000Z'),
    session('duplicate-late', '2026-08-15T10:00:00.000Z'),
    session('duplicate-late', '2026-08-15T11:00:00.000Z'),
  ];

  assert.deepEqual(
    getRecentSessions(sessions).map(item => item.id),
    ['latest', 'duplicate-late', 'middle'],
  );
  assert.equal(getRecentSessions(sessions).length, 3);
});

test('supports a smaller explicit limit', () => {
  const sessions = [
    session('one', '2026-08-16T10:00:00.000Z'),
    session('two', '2026-08-15T10:00:00.000Z'),
  ];

  assert.deepEqual(getRecentSessions(sessions, 1).map(item => item.id), ['one']);
  assert.deepEqual(getRecentSessions(sessions, 0), []);
});
