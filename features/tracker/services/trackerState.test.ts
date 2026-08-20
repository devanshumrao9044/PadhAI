import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileTrackerState } from './trackerState.ts';
import type { Chapter, Subject, Topic } from '@/types/models.ts';

const subject = (id: string, isDeleted = false): Subject => ({
  id,
  userId: 'user-1',
  name: id,
  colorHex: '#0A7EA4',
  iconName: 'book',
  displayOrder: 0,
  createdAt: new Date(0).toISOString(),
  isDeleted,
});

const chapter = (id: string, subjectId: string, isDeleted = false): Chapter => ({
  id,
  subjectId,
  userId: 'user-1',
  name: id,
  status: 'not_started',
  plannedDate: null,
  completedDate: null,
  displayOrder: 0,
  createdAt: new Date(0).toISOString(),
  isDeleted,
});

const topic = (id: string, chapterId: string, isDeleted = false): Topic => ({
  id,
  chapterId,
  name: id,
  isDone: false,
  displayOrder: 0,
  isDeleted,
});

test('tracker reconciliation keeps only active subject, chapter, and topic relationships', () => {
  const result = reconcileTrackerState(
    [subject('physics'), subject('deleted-subject', true)],
    [chapter('kinematics', 'physics'), chapter('deleted-chapter', 'physics', true), chapter('orphan-chapter', 'deleted-subject')],
    [topic('valid-topic', 'kinematics'), topic('deleted-topic', 'kinematics', true), topic('orphan-topic', 'orphan-chapter')],
  );

  assert.deepEqual(result.subjects.map(item => item.id), ['physics']);
  assert.deepEqual(result.chapters.map(item => item.id), ['kinematics']);
  assert.deepEqual(result.topics.map(item => item.id), ['valid-topic']);
});
