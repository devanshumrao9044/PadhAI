import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_MAX_DIMENSION,
  AVATAR_SUPPORTED_INPUT_FORMATS,
  MAX_AVATAR_OUTPUT_BYTES,
  MAX_AVATAR_SOURCE_BYTES,
  formatFileSize,
} from './avatarPolicy.ts';

test('avatar policy uses bounded source, output, and dimension limits', () => {
  assert.equal(MAX_AVATAR_SOURCE_BYTES, 5 * 1024 * 1024);
  assert.equal(MAX_AVATAR_OUTPUT_BYTES, 200 * 1024);
  assert.equal(AVATAR_MAX_DIMENSION, 512);
  assert.match(AVATAR_SUPPORTED_INPUT_FORMATS, /JPEG/);
  assert.match(AVATAR_SUPPORTED_INPUT_FORMATS, /PNG/);
  assert.match(AVATAR_SUPPORTED_INPUT_FORMATS, /WebP/);
  assert.match(AVATAR_SUPPORTED_INPUT_FORMATS, /HEIC/);
});

test('avatar policy formats selected-file sizes clearly', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(10 * 1024), '10 KB');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB');
});
