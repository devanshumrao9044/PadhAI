-- Keep soft-deleted subjects readable to the owner for safe RETURNING behavior;
-- the app filters is_deleted = false when loading active subjects.
BEGIN;

DROP POLICY IF EXISTS "subjects_select_owner" ON public.subjects;
CREATE POLICY "subjects_select_owner" ON public.subjects
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

COMMIT;
