import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompletedSessionXP,
  getFocusSessionLabel,
  mergeFocusSessions,
  mergeXPTransactions,
} from './sessionPersistence.ts';
import type { FocusSession, XPTransaction } from '@/types/models';

const session = (id: string, createdAt: string, xpEarned = 0): FocusSession => ({
  id,
  userId: 'user-1',
  subjectId: null,
  chapterId: null,
  durationPlannedMins: 120,
  durationActualMins: 120,
  completed: true,
  xpEarned,
  xpDeducted: 0,
  brokenAtPercent: 100,
  sessionDate: '2026-08-21',
  createdAt,
});

const transaction = (id: string, createdAt: string, amount: number): XPTransaction => ({
  id,
  userId: 'user-1',
  amount,
  reason: 'session_complete',
  createdAt,
});

test('General Study sessions are valid without tracker links', () => {
  assert.equal(getFocusSessionLabel({ subjectId: null, chapterId: null }), 'general');
  assert.equal(calculateCompletedSessionXP(120), 240);
  assert.equal(calculateCompletedSessionXP(120, 50), 290);
});

test('cloud hydration retains a newer local session with the same id', () => {
  const cloud = [session('same', '2026-08-21T10:00:00.000Z', 0)];
  const local = [
    session('same', '2026-08-21T10:01:00.000Z', 240),
    session('local', '2026-08-21T10:02:00.000Z', 20),
  ];
  const merged = mergeFocusSessions(cloud, local);
  assert.deepEqual(merged.map(item => item.id), ['local', 'same']);
  assert.equal(merged.find(item => item.id === 'same')?.xpEarned, 240);
});

test('cloud hydration retains local XP transactions until sync', () => {
  const merged = mergeXPTransactions(
    [transaction('cloud', '2026-08-21T10:00:00.000Z', 10)],
    [transaction('local', '2026-08-21T10:01:00.000Z', 240)],
  );
  assert.deepEqual(merged.map(item => item.id), ['local', 'cloud']);
});
