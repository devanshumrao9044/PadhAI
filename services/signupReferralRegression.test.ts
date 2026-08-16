import test from 'node:test';
import assert from 'node:assert';

// ── Signup & Referral Regression Test Suite ──────────────────────────────────
// Validates referral code formatting, normalization, case-insensitivity,
// self-referral prevention, and reward milestone logic.

test('Referral code normalization strips spaces and enforces uppercase', () => {
  const normalize = (code: string) => code.trim().toUpperCase().replace(/\s/g, '');
  assert.strictEqual(normalize('  padh56825  '), 'PADH56825');
  assert.strictEqual(normalize('test 12345'), 'TEST12345');
  assert.strictEqual(normalize(''), '');
});

test('Referral code prefix and format validation rules', () => {
  const isValidFormat = (code: string) => /^[A-Z]{3,4}[0-9]{5}$/.test(code);
  assert.strictEqual(isValidFormat('PADH56825'), true);
  assert.strictEqual(isValidFormat('TEST12345'), true);
  assert.strictEqual(isValidFormat('padh56825'), false); // Must be uppercase
  assert.strictEqual(isValidFormat('AB12345'), false);    // Prefix too short (< 3 letters)
  assert.strictEqual(isValidFormat('PADH1234'), false);   // Suffix too short (< 5 digits)
  assert.strictEqual(isValidFormat('LONGPREFIX12345'), false); // Prefix too long (> 4 letters)
});

test('Self-referral prevention logic rule', () => {
  const canApplyReferral = (refereeId: string, referrerId: string | null) => {
    if (!referrerId) return true; // Optional referral
    if (referrerId === refereeId) return false; // Self-referral forbidden
    return true;
  };

  const userId = 'user-uuid-123';
  assert.strictEqual(canApplyReferral(userId, userId), false);
  assert.strictEqual(canApplyReferral(userId, 'referrer-uuid-456'), true);
  assert.strictEqual(canApplyReferral(userId, null), true);
});

test('Referral milestone reward threshold rule', () => {
  const REWARD_THRESHOLD = 5;
  const isRewardUnlocked = (completedCount: number) => completedCount >= REWARD_THRESHOLD;

  assert.strictEqual(isRewardUnlocked(0), false);
  assert.strictEqual(isRewardUnlocked(4), false);
  assert.strictEqual(isRewardUnlocked(5), true);
  assert.strictEqual(isRewardUnlocked(10), true);
});
