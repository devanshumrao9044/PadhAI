-- Suspended groups must not accept new study activity even if an older client
-- bypasses the current UI. Clearing stale presence remains allowed.

CREATE OR REPLACE FUNCTION private.update_study_group_presence(
  p_group_id uuid,
  p_session_id uuid,
  p_status text,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_started_at timestamptz := COALESCE(p_started_at, statement_timestamp());
  v_group_status text;
  v_suspended_until timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_status NOT IN ('studying', 'paused', 'offline') THEN RAISE EXCEPTION 'Invalid presence status'; END IF;

  SELECT sg.status, sg.suspended_until
    INTO v_group_status, v_suspended_until
    FROM public.study_groups AS sg
   WHERE sg.id = p_group_id
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Study Group not found'; END IF;
  IF v_group_status = 'archived' OR (v_group_status = 'suspended' AND v_suspended_until > statement_timestamp()) THEN
    RAISE EXCEPTION 'This Study Group is temporarily suspended.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.study_group_members AS gm
     WHERE gm.group_id = p_group_id
       AND gm.user_id = v_user_id
       AND gm.status = 'approved'
  ) THEN RAISE EXCEPTION 'Approved group membership required'; END IF;

  IF v_started_at > statement_timestamp() + interval '5 minutes' THEN RAISE EXCEPTION 'Presence timestamp is in the future'; END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.focus_sessions AS fs
     WHERE fs.id = p_session_id AND fs.user_id = v_user_id
  ) THEN RAISE EXCEPTION 'Focus session is not owned by the current user'; END IF;

  INSERT INTO public.study_group_presence (
    group_id, user_id, session_id, status, started_at, last_seen_at, updated_at
  ) VALUES (
    p_group_id, v_user_id, p_session_id, p_status, v_started_at, statement_timestamp(), statement_timestamp()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE SET
    session_id = EXCLUDED.session_id,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    last_seen_at = statement_timestamp(),
    updated_at = statement_timestamp();
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION private.update_study_group_presence(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_study_group_presence(uuid, uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.assert_study_group_active(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_status text;
  v_suspended_until timestamptz;
BEGIN
  SELECT sg.status, sg.suspended_until
    INTO v_status, v_suspended_until
    FROM public.study_groups AS sg
   WHERE sg.id = p_group_id
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Study Group not found'; END IF;
  IF v_status = 'archived' OR (v_status = 'suspended' AND v_suspended_until > statement_timestamp()) THEN
    RAISE EXCEPTION 'This Study Group is temporarily suspended.';
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION private.assert_study_group_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_study_group_active(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_study_group_active(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.assert_study_group_active(p_group_id);
$function$;

REVOKE ALL ON FUNCTION public.assert_study_group_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_study_group_active(uuid) TO authenticated;
