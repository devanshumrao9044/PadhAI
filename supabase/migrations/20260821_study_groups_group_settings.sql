-- Study Group settings editing for the saved edit_group permission.
-- No audit history or additional storage is created.

CREATE OR REPLACE FUNCTION private.update_study_group_details(
  p_group_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_rules text DEFAULT '',
  p_target_exam text DEFAULT 'OTHER',
  p_daily_goal_minutes integer DEFAULT 120,
  p_max_members integer DEFAULT 12
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF NOT (SELECT private.has_study_group_permission(p_group_id, 'edit_group')) THEN
    RAISE EXCEPTION 'Group-edit permission required';
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Group name must be between 2 and 60 characters';
  END IF;
  IF char_length(COALESCE(p_description, '')) > 240 OR char_length(COALESCE(p_rules, '')) > 2000 THEN
    RAISE EXCEPTION 'Group text is too long';
  END IF;
  IF COALESCE(p_daily_goal_minutes, 0) NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'Daily goal must be between 1 and 1440 minutes';
  END IF;
  IF COALESCE(p_max_members, 0) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Member limit must be between 2 and 100';
  END IF;

  UPDATE public.study_groups
  SET name = btrim(p_name),
      description = COALESCE(p_description, ''),
      rules = COALESCE(p_rules, ''),
      target_exam = upper(COALESCE(NULLIF(btrim(p_target_exam), ''), 'OTHER')),
      daily_goal_minutes = p_daily_goal_minutes,
      max_members = p_max_members,
      updated_at = now()
  WHERE id = p_group_id AND status = 'active';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_study_group_details(
  p_group_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_rules text DEFAULT '',
  p_target_exam text DEFAULT 'OTHER',
  p_daily_goal_minutes integer DEFAULT 120,
  p_max_members integer DEFAULT 12
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT private.update_study_group_details(
    p_group_id, p_name, p_description, p_rules, p_target_exam,
    p_daily_goal_minutes, p_max_members
  );
$$;

REVOKE ALL ON FUNCTION private.update_study_group_details(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_study_group_details(uuid, text, text, text, text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.update_study_group_details(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_study_group_details(uuid, text, text, text, text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.update_study_group_details(uuid, text, text, text, text, integer, integer) IS
  'Updates group details only for the owner or an approved co-admin with edit_group permission.';
