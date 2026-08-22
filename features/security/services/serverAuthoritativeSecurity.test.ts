import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const appContext = read('contexts/AppContext.tsx');
const migration = read('supabase/migrations/20260822_server_authoritative_security.sql');
const authGuard = read('auth/AuthRouteGuard.tsx');
const referralScreen = read('app/referral.tsx');
const studyGroups = read('features/study-groups/services/studyGroups.ts');

function assertNoDirectMutation(source: string, table: string): void {
  const directMutation = new RegExp(`from\\(['"]${table}['"]\\)[\\s\\S]{0,260}\\.(insert|upsert|update|delete)\\(`);
  assert.equal(directMutation.test(source), false, `${table} must not be mutated directly by the client`);
}

test('progression tables are read-only from the active client', () => {
  assertNoDirectMutation(appContext, 'focus_sessions');
  assertNoDirectMutation(appContext, 'daily_summary');
  assertNoDirectMutation(appContext, 'xp_transactions');
  assertNoDirectMutation(authGuard, 'users');
  assertNoDirectMutation(referralScreen, 'users');
});

test('focus completion and offline replay share the server settlement RPC', () => {
  assert.match(appContext, /submitOfflineFocusSession\(settlement\)/);
  assert.match(appContext, /enqueueOfflineFocusSession\(settlement\)/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.focus_sessions FROM authenticated/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.daily_summary FROM authenticated/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.xp_transactions FROM authenticated/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.sync_offline_focus_session/);
});

test('offline settlement rejects timestamp drift, future timestamps, and invalid completion states', () => {
  assert.match(migration, /p_completed IS DISTINCT FROM \(NOT p_broken\)/);
  assert.match(migration, /timestamp_in_future/);
  assert.match(migration, /timestamp_duration_mismatch/);
  assert.match(migration, /ABS\(v_wall_seconds - p_elapsed_seconds\) > 120/);
  assert.match(migration, /SELECT COALESCE\(u\.daily_goal_minutes, 120\).*FOR UPDATE/s);
});

test('profile updates cannot write server-controlled progression fields', () => {
  const profileGrant = migration.match(/GRANT UPDATE \(([\s\S]*?)\) ON public\.users TO authenticated;/)?.[1] ?? '';
  assert.match(profileGrant, /\bname\b/);
  assert.doesNotMatch(profileGrant, /\bxp\b/);
  assert.doesNotMatch(profileGrant, /\bstreak\b/);
  assert.doesNotMatch(profileGrant, /\bhas_unlocked_reward\b/);
  assert.doesNotMatch(profileGrant, /\breward_popup_seen\b/);
});

test('streak expiry and reward acknowledgement use narrow RPCs', () => {
  assert.match(authGuard, /supabase\.rpc\(['"]mark_streak_broken['"](?:[,)]|;)/);
  assert.match(referralScreen, /supabase\.rpc\(['"]mark_reward_popup_seen['"](?:[,)]|;)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.mark_streak_broken/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.mark_reward_popup_seen/);
});

test('study-group presence is server-validated and direct group-session inserts are absent', () => {
  assert.match(studyGroups, /supabase\.rpc\(['"]update_study_group_presence['"],/);
  assert.match(studyGroups, /supabase\.rpc\(['"]clear_study_group_presence['"],/);
  assert.doesNotMatch(studyGroups, /from\(['"]study_group_presence['"]\)[\s\S]{0,260}\.(insert|upsert|update|delete)\(/);
  assert.doesNotMatch(studyGroups, /from\(['"]study_group_sessions['"]\)[\s\S]{0,260}\.(insert|upsert|update|delete)\(/);
});
