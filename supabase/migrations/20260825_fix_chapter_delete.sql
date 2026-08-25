-- Chapter deletion must return an explicit authorization/result signal.
-- The existing SELECT policy hides soft-deleted rows, so a client UPDATE with
-- RETURNING can otherwise look like a successful no-op. These RPCs preserve the
-- soft-delete history and bind every mutation to auth.uid().

CREATE OR REPLACE FUNCTION private.soft_delete_chapter(p_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_chapter_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.chapters
     SET is_deleted = true
   WHERE id = p_chapter_id
     AND user_id = auth.uid()
     AND COALESCE(is_deleted, false) = false;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION private.soft_delete_chapter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.soft_delete_chapter(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_chapter(p_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.soft_delete_chapter(p_chapter_id);
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_chapter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_chapter(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.soft_delete_chapters(p_chapter_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR p_chapter_ids IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.chapters
     SET is_deleted = true
   WHERE id = ANY(p_chapter_ids)
     AND user_id = auth.uid()
     AND COALESCE(is_deleted, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION private.soft_delete_chapters(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.soft_delete_chapters(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_chapters(p_chapter_ids uuid[])
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.soft_delete_chapters(p_chapter_ids);
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_chapters(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_chapters(uuid[]) TO authenticated;
