-- Fix subjects RLS policy for soft-deletes
-- Removing "AND is_deleted = false" from subjects_select_owner so RETURNING * after setting is_deleted = true does not violate RLS.
-- Application layer already filters is_deleted = false when loading subjects.

DROP POLICY IF EXISTS "subjects_select_owner" ON public.subjects;

CREATE POLICY "subjects_select_owner" ON public.subjects
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
