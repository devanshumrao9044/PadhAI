import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStudyDuration, PRESENCE_STALE_AFTER_MS, STUDY_GROUP_ICON_OPTIONS } from './studyGroupsPolicy.ts';

test('formats group study duration without negative or fractional minutes', () => {
  assert.equal(formatStudyDuration(-5), '0m');
  assert.equal(formatStudyDuration(0), '0m');
  assert.equal(formatStudyDuration(59.9), '59m');
  assert.equal(formatStudyDuration(60), '1h 0m');
  assert.equal(formatStudyDuration(125), '2h 5m');
});

test('keeps the built-in group icon catalog unique and storage-free', () => {
  const keys = STUDY_GROUP_ICON_OPTIONS.map(option => option.key);
  const icons = STUDY_GROUP_ICON_OPTIONS.map(option => option.icon);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(icons).size, icons.length);
  assert.ok(keys.includes('books'));
  assert.ok(keys.includes('rocket'));
});

test('uses a bounded presence-stale window for offline fallback', () => {
  assert.equal(PRESENCE_STALE_AFTER_MS, 90_000);
  assert.ok(PRESENCE_STALE_AFTER_MS >= 60_000);
  assert.ok(PRESENCE_STALE_AFTER_MS <= 120_000);
});
