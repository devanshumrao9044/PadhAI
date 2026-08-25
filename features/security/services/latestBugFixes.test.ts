import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../..', import.meta.url).pathname;
const read = (relativePath: string) => readFileSync(`${root}/${relativePath}`, 'utf8');

test('join and lifecycle migrations qualify status and keep owner actions server-authorized', () => {
  const joinMigration = read('supabase/migrations/20260825_fix_join_status_ambiguity.sql');
  const lifecycleMigration = read('supabase/migrations/20260825_study_group_lifecycle.sql');
  const rejoinMigration = read('supabase/migrations/20260825_fix_join_membership_rejoin.sql');

  assert.match(joinMigration, /g\.status/);
  assert.match(joinMigration, /m\.status/);
  assert.match(rejoinMigration, /gs\.status/);
  assert.match(rejoinMigration, /gm\.status/);
  assert.match(lifecycleMigration, /private\.is_padhai_owner\(\)/);
  assert.match(lifecycleMigration, /suspended_until/);
  assert.match(lifecycleMigration, /delete_study_group_permanently/);
  assert.match(lifecycleMigration, /REVOKE ALL ON FUNCTION private\.delete_study_group_permanently/);
});

test('chapter deletion uses explicit owner-bound soft-delete RPCs', () => {
  const migration = read('supabase/migrations/20260825_fix_chapter_delete.sql');
  const context = read('contexts/AppContext.tsx');
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /soft_delete_chapters/);
  assert.match(context, /supabase\.rpc\('soft_delete_chapter'/);
  assert.match(context, /supabase\.rpc\('soft_delete_chapters'/);
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
});
