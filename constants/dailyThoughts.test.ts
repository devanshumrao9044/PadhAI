import test from 'node:test';
import assert from 'node:assert/strict';
import { getThoughtForDate } from './dailyThoughts.ts';

test('February-like 30-day rotation has no repeats within the month', () => {
  const thoughts = Array.from({ length: 30 }, (_, day) => getThoughtForDate(new Date(2026, 3, day + 1)).en);
  assert.equal(new Set(thoughts).size, 30);
});

test('31-day rotation has no repeats within the month', () => {
  const thoughts = Array.from({ length: 31 }, (_, day) => getThoughtForDate(new Date(2026, 6, day + 1)).en);
  assert.equal(new Set(thoughts).size, 31);
});

test('same date is deterministic', () => {
  const date = new Date(2026, 7, 16);
  assert.deepEqual(getThoughtForDate(date), getThoughtForDate(date));
});
