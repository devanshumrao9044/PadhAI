-- Keep subject deletion and dependent chapter cleanup atomic.
-- SECURITY INVOKER ensures the caller's existing RLS policies still apply.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_subject_and_chapters(p_subject_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  deleted_subjects integer;
BEGIN
  UPDATE public.chapters
     SET is_deleted = true
   WHERE subject_id = p_subject_id
     AND user_id = auth.uid()
     AND is_deleted = false;

  UPDATE public.subjects
     SET is_deleted = true
   WHERE id = p_subject_id
     AND user_id = auth.uid()
     AND is_deleted = false;

  GET DIAGNOSTICS deleted_subjects = ROW_COUNT;
  RETURN deleted_subjects > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_subject_and_chapters(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_subject_and_chapters(uuid) TO authenticated;

COMMIT;
