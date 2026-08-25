import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../..', import.meta.url).pathname;
const read = (relativePath: string) => readFileSync(`${root}/${relativePath}`, 'utf8');

test('join and lifecycle migrations qualify status and keep owner actions server-authorized', () => {
  const joinMigration = read('supabase/migrations/20260825_fix_join_status_ambiguity.sql');
  const lifecycleMigration = read('supabase/migrations/20260825_study_group_lifecycle.sql');
  const rejoinMigration = read('supabase/migrations/20260825_fix_join_membership_rejoin.sql');
  const suspensionMigration = read('supabase/migrations/20260825_enforce_group_suspension.sql');

  assert.match(joinMigration, /g\.status/);
  assert.match(joinMigration, /m\.status/);
  assert.match(rejoinMigration, /gs\.status/);
  assert.match(rejoinMigration, /gm\.status/);
  assert.match(lifecycleMigration, /private\.is_padhai_owner\(\)/);
  assert.match(lifecycleMigration, /suspended_until/);
  assert.match(lifecycleMigration, /delete_study_group_permanently/);
  assert.match(lifecycleMigration, /REVOKE ALL ON FUNCTION private\.delete_study_group_permanently/);
  assert.match(suspensionMigration, /private\.assert_study_group_active/);
  assert.match(suspensionMigration, /temporarily suspended/);
});

test('chapter deletion uses explicit owner-bound soft-delete RPCs', () => {
  const migration = read('supabase/migrations/20260825_fix_chapter_delete.sql');
  const context = read('contexts/AppContext.tsx');
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /soft_delete_chapters/);
  assert.match(context, /supabase\.rpc\('soft_delete_chapter'/);
  assert.match(context, /supabase\.rpc\('soft_delete_chapters'/);
});

test('Infinity selection is exclusive and Allowed Apps carries full labels and icons', () => {
  const focus = read('app/(tabs)/focus.tsx');
  const allowedApps = read('app/focus/allowed-apps.tsx');
  const policy = read('modules/padhai-focus-guard/android/src/main/java/com/padhai/focusguard/FocusGuardAppPolicy.kt');
  assert.match(focus, /!openEndedMode && !isCustomSelected && selectedMins === d/);
  assert.match(allowedApps, /<Image source=\{\{ uri: app\.iconBase64 \}\}/);
  assert.doesNotMatch(allowedApps, /app\.label\}.*numberOfLines=\{1\}/);
  assert.match(policy, /"iconBase64" to encodeIcon/);
});

test('native installed-app decisions stay boolean and Tracker cannot start a direct subject timer', () => {
  const policy = read('modules/padhai-focus-guard/android/src/main/java/com/padhai/focusguard/FocusGuardAppPolicy.kt');
  const module = read('modules/padhai-focus-guard/android/src/main/java/com/padhai/focusguard/PadhAIFocusGuardModule.kt');
  const tracker = read('app/(tabs)/tracker.tsx');
  const productivity = read('features/productivity/services/productivity.ts');
  const models = read('types/models.ts');
  const cacheCodec = read('features/core/services/cacheCodec.ts');
  assert.match(policy, /"allowed" to decision\.allowed/);
  assert.doesNotMatch(policy, /"allowed" to decision\.allowed\.toString\(\)/);
  assert.match(module, /getInstalledApps/);
  assert.doesNotMatch(tracker, /toggleSubjectTimer/);
  assert.doesNotMatch(tracker, /loadSubjectTimers/);
  assert.ok(tracker.includes("pathname: '/(tabs)/focus'"));
  assert.doesNotMatch(productivity, /SubjectTimerState|loadSubjectTimers|saveSubjectTimers/);
  assert.doesNotMatch(models, /SubjectTimerState/);
  assert.doesNotMatch(cacheCodec, /subjectTimers/);
});

test('local ticket history is bounded and supports device-only hiding', () => {
  const cacheCodec = read('features/core/services/cacheCodec.ts');
  const supportCache = read('features/study-groups/services/supportCache.ts');
  const review = read('app/review-tickets.tsx');
  assert.match(cacheCodec, /supportTickets/);
  assert.match(supportCache, /slice\(0, 100\)/);
  assert.match(supportCache, /hiddenTicketIds/);
  assert.match(review, /hideSupportTicket/);
  assert.match(review, /hideSupportReport/);
});

test('open-ended focus is manually finished but still bounded for server verification', () => {
  const focus = read('app/(tabs)/focus.tsx');
  const active = read('app/focus/active.tsx');
  const models = read('types/models.ts');
  const context = read('contexts/AppContext.tsx');
  assert.match(focus, /OPEN_ENDED_PLANNED_MINS = 1440/);
  assert.match(focus, /startSession\(effectiveMins, selectedSubjectId, selectedChapterId, false, undefined, studyGroupId, openEndedMode\)/);
  assert.match(active, /activeSession\?\.openEnded/);
  assert.match(active, /handleManualFinish/);
  assert.match(models, /openEnded\?: boolean/);
  assert.match(context, /openEnded,/);
  assert.match(context, /assertStudyGroupActive\(studyGroupId\)/);
});
