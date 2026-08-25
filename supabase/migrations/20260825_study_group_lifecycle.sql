-- Owner-authorized Study Group lifecycle controls.
-- Suspension is time-bounded; permanent deletion intentionally removes the group's
-- memberships, presence, sessions, invites, and reports while preserving any
-- linked support ticket as an unscoped ticket via its existing SET NULL FKs.

ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

ALTER TABLE public.study_groups
  DROP CONSTRAINT IF EXISTS study_groups_status_check;

ALTER TABLE public.study_groups
  ADD CONSTRAINT study_groups_status_check
  CHECK (status IN ('active', 'suspended', 'archived'));

CREATE OR REPLACE FUNCTION private.suspend_study_group(
  p_group_id uuid,
  p_duration_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_is_owner boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT (sg.owner_id = v_user_id OR private.is_padhai_owner())
    INTO v_is_owner
    FROM public.study_groups sg
   WHERE sg.id = p_group_id
   LIMIT 1;

  IF NOT COALESCE(v_is_owner, false) THEN
    RETURN false;
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 15 AND 10080 THEN
    RETURN false;
  END IF;

  UPDATE public.study_groups
     SET status = 'suspended',
         suspended_until = statement_timestamp() + make_interval(mins => p_duration_minutes),
         updated_at = statement_timestamp()
   WHERE id = p_group_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION private.suspend_study_group(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.suspend_study_group(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.suspend_study_group(
  p_group_id uuid,
  p_duration_minutes integer
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.suspend_study_group(p_group_id, p_duration_minutes);
$function$;

REVOKE ALL ON FUNCTION public.suspend_study_group(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_study_group(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION private.restore_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_is_owner boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT (sg.owner_id = v_user_id OR private.is_padhai_owner())
    INTO v_is_owner
    FROM public.study_groups sg
   WHERE sg.id = p_group_id
   LIMIT 1;

  IF NOT COALESCE(v_is_owner, false) THEN
    RETURN false;
  END IF;

  UPDATE public.study_groups
     SET status = 'active',
         suspended_until = NULL,
         updated_at = statement_timestamp()
   WHERE id = p_group_id
     AND status <> 'archived';
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION private.restore_study_group(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.restore_study_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.restore_study_group(p_group_id);
$function$;

REVOKE ALL ON FUNCTION public.restore_study_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_study_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.delete_study_group_permanently(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_is_owner boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT (sg.owner_id = v_user_id OR private.is_padhai_owner())
    INTO v_is_owner
    FROM public.study_groups sg
   WHERE sg.id = p_group_id
   LIMIT 1;

  IF NOT COALESCE(v_is_owner, false) THEN
    RETURN false;
  END IF;

  -- study_group_tickets.group_id/report_id already use SET NULL, so support
  -- history remains visible without retaining deleted group/report records.
  DELETE FROM public.study_group_reports WHERE group_id = p_group_id;
  DELETE FROM public.study_groups WHERE id = p_group_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION private.delete_study_group_permanently(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.delete_study_group_permanently(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_study_group_permanently(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.delete_study_group_permanently(p_group_id);
$function$;

REVOKE ALL ON FUNCTION public.delete_study_group_permanently(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_study_group_permanently(uuid) TO authenticated;

-- Existing public listing/invite RPCs intentionally retain their established
-- return contracts. Their public wrappers delegate to these private functions.
-- Expired suspensions are treated as active without requiring a background job.
CREATE OR REPLACE FUNCTION private.get_public_study_groups(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  target_exam text,
  daily_goal_minutes integer,
  max_members integer,
  visibility text,
  icon_key text,
  join_code text,
  member_count bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT g.id, g.name, g.description, g.target_exam, g.daily_goal_minutes,
         g.max_members, g.visibility, g.icon_key, g.join_code,
         COUNT(m.id) FILTER (WHERE m.status = 'approved') AS member_count,
         g.created_at
    FROM public.study_groups AS g
    LEFT JOIN public.study_group_members AS m ON m.group_id = g.id
   WHERE g.visibility = 'public'
     AND (g.status = 'active' OR (g.status = 'suspended' AND g.suspended_until <= statement_timestamp()))
     AND (btrim(COALESCE(p_query, '')) = ''
       OR lower(g.name) LIKE '%' || lower(btrim(p_query)) || '%'
       OR lower(g.join_code) = lower(btrim(p_query))
       OR lower(g.target_exam) LIKE '%' || lower(btrim(p_query)) || '%')
   GROUP BY g.id
   ORDER BY g.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 30);
$function$;

CREATE OR REPLACE FUNCTION private.get_study_group_by_invite(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  rules text,
  target_exam text,
  daily_goal_minutes integer,
  max_members integer,
  visibility text,
  icon_key text,
  member_count bigint,
  invite_valid boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT g.id, g.name, g.description, g.rules, g.target_exam, g.daily_goal_minutes,
         g.max_members, g.visibility, g.icon_key,
         COUNT(m.id) FILTER (WHERE m.status = 'approved') AS member_count,
         true AS invite_valid
    FROM public.study_group_invites AS i
    JOIN public.study_groups AS g ON g.id = i.group_id
    LEFT JOIN public.study_group_members AS m ON m.group_id = g.id
   WHERE i.token = btrim(COALESCE(p_token, ''))
     AND i.revoked_at IS NULL
     AND (i.expires_at IS NULL OR i.expires_at > statement_timestamp())
     AND (g.status = 'active' OR (g.status = 'suspended' AND g.suspended_until <= statement_timestamp()))
   GROUP BY g.id;
$function$;

-- Joining must reject currently suspended groups, while an expired suspension
-- can be joined normally without a cleanup job.
CREATE OR REPLACE FUNCTION private.join_study_group(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL
)
RETURNS TABLE (membership_id uuid, group_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  g public.study_groups%ROWTYPE;
  m public.study_group_members%ROWTYPE;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT * INTO g FROM public.study_groups sg WHERE sg.id = p_group_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Study Group not found.'; END IF;
  IF g.status = 'archived' OR (g.status = 'suspended' AND g.suspended_until > statement_timestamp()) THEN
    RAISE EXCEPTION 'This Study Group is temporarily suspended.';
  END IF;
  IF g.visibility = 'private' AND NOT EXISTS (
    SELECT 1 FROM public.study_group_invites i
     WHERE i.group_id = g.id AND i.token = NULLIF(trim(p_invite_token), '') AND i.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A valid invite is required for this private group.';
  END IF;
  SELECT * INTO m FROM public.study_group_members gm WHERE gm.group_id = g.id AND gm.user_id = v_user_id FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT m.id, m.group_id, m.status;
    RETURN;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.study_group_members gm WHERE gm.group_id = g.id AND gm.status = 'approved';
  IF v_count >= g.max_members THEN RAISE EXCEPTION 'This Study Group is full.'; END IF;
  INSERT INTO public.study_group_members (group_id, user_id, role, status, permissions, icon_key)
  VALUES (g.id, v_user_id, CASE WHEN g.owner_id = v_user_id THEN 'owner' ELSE 'member' END,
          CASE WHEN g.owner_id = v_user_id OR g.visibility = 'public' THEN 'approved' ELSE 'pending' END,
          '{}'::jsonb, g.icon_key)
  RETURNING * INTO m;
  RETURN QUERY SELECT m.id, m.group_id, m.status;
END;
$function$;

REVOKE ALL ON FUNCTION private.join_study_group(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.join_study_group(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_study_group(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL
)
RETURNS TABLE (membership_id uuid, group_id uuid, status text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.join_study_group(p_group_id, p_invite_token);
$function$;

REVOKE ALL ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO authenticated;
