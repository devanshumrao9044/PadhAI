import test from 'node:test';
import assert from 'node:assert/strict';
import { getPasswordProviderError, validatePassword } from './passwordPolicy.ts';

test('rejects passwords shorter than six characters', () => {
  assert.deepEqual(validatePassword('Ab1!'), {
    valid: false,
    error: 'Password must be at least 6 characters.',
  });
});

test('requires mixed character classes for a six-character password', () => {
  assert.equal(validatePassword('abcdef').valid, false);
  assert.equal(validatePassword('Ab1!xy').valid, true);
});

test('maps provider leaked-password errors to clear UX guidance', () => {
  assert.equal(
    getPasswordProviderError('Password has been exposed in a data breach'),
    'Choose a stronger password. This password is too weak or has appeared in a known breach.',
  );
  assert.equal(getPasswordProviderError('Invalid login credentials'), null);
});
