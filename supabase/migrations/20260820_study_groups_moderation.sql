-- Study Groups, private/public membership, low-write live presence, moderation reports, and support tickets.
-- All sensitive access is enforced by RLS/RPCs. No files or paid services are required.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 240),
  rules text NOT NULL DEFAULT '' CHECK (char_length(rules) <= 2000),
  target_exam text NOT NULL DEFAULT 'OTHER' CHECK (char_length(btrim(target_exam)) BETWEEN 1 AND 40),
  daily_goal_minutes integer NOT NULL DEFAULT 120 CHECK (daily_goal_minutes BETWEEN 1 AND 1440),
  max_members integer NOT NULL DEFAULT 12 CHECK (max_members BETWEEN 2 AND 100),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  icon_key text NOT NULL DEFAULT 'books' CHECK (icon_key ~ '^[a-z0-9_-]{2,40}$'),
  join_code text NOT NULL UNIQUE CHECK (join_code ~ '^[A-Z0-9]{6,12}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  icon_key text NOT NULL DEFAULT 'books' CHECK (icon_key ~ '^[a-z0-9_-]{2,40}$'),
  joined_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.study_group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_presence (
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  status text NOT NULL DEFAULT 'studying' CHECK (status IN ('studying', 'paused', 'offline')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.study_group_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_session_id uuid REFERENCES public.focus_sessions(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  actual_minutes integer NOT NULL DEFAULT 0 CHECK (actual_minutes BETWEEN 0 AND 1440),
  completed boolean NOT NULL DEFAULT false,
  broken boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (focus_session_id)
);

CREATE TABLE IF NOT EXISTS public.study_group_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason_code text NOT NULL CHECK (reason_code IN ('spam', 'abuse', 'fake_study_time', 'inappropriate_content', 'harassment', 'privacy', 'other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  resolution text NOT NULL DEFAULT '' CHECK (char_length(resolution) <= 1000),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.study_groups(id) ON DELETE SET NULL,
  report_id uuid REFERENCES public.study_group_reports(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('bug', 'account', 'study_group', 'report_follow_up', 'feature_request', 'other')),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 3 AND 100),
  details text NOT NULL CHECK (char_length(btrim(details)) BETWEEN 5 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolution text NOT NULL DEFAULT '' CHECK (char_length(resolution) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS study_groups_visibility_created_idx
  ON public.study_groups (visibility, status, created_at DESC);
CREATE INDEX IF NOT EXISTS study_groups_owner_idx
  ON public.study_groups (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS study_group_members_group_status_idx
  ON public.study_group_members (group_id, status, role);
CREATE INDEX IF NOT EXISTS study_group_members_user_idx
  ON public.study_group_members (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS study_group_invites_group_active_idx
  ON public.study_group_invites (group_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS study_group_presence_group_seen_idx
  ON public.study_group_presence (group_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS study_group_sessions_group_started_idx
  ON public.study_group_sessions (group_id, started_at DESC);
CREATE INDEX IF NOT EXISTS study_group_sessions_user_started_idx
  ON public.study_group_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS study_group_reports_group_status_idx
  ON public.study_group_reports (group_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS study_group_reports_reporter_idx
  ON public.study_group_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS study_group_tickets_user_status_idx
  ON public.study_group_tickets (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS study_group_tickets_status_idx
  ON public.study_group_tickets (status, created_at DESC);

CREATE OR REPLACE FUNCTION private.is_padhai_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_admins
    WHERE user_id = (SELECT auth.uid())
      AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_study_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_group_members
    WHERE group_id = p_group_id
      AND user_id = (SELECT auth.uid())
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_study_group_admin(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT (SELECT private.is_padhai_owner()) OR EXISTS (
    SELECT 1
    FROM public.study_group_members
    WHERE group_id = p_group_id
      AND user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION private.valid_study_group_invite(p_group_id uuid, p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_group_invites
    WHERE group_id = p_group_id
      AND token = btrim(COALESCE(p_token, ''))
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION private.is_padhai_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_study_group_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_study_group_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.valid_study_group_invite(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_padhai_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_study_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_study_group_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.valid_study_group_invite(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_study_group(
  p_name text,
  p_description text DEFAULT '',
  p_rules text DEFAULT '',
  p_target_exam text DEFAULT 'OTHER',
  p_daily_goal_minutes integer DEFAULT 120,
  p_max_members integer DEFAULT 12,
  p_visibility text DEFAULT 'private',
  p_icon_key text DEFAULT 'books'
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  rules text,
  target_exam text,
  daily_goal_minutes integer,
  max_members integer,
  visibility text,
  icon_key text,
  join_code text,
  invite_token text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_group_id uuid;
  v_join_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_invite_token text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Group name must be between 2 and 60 characters';
  END IF;
  IF COALESCE(p_visibility, 'private') NOT IN ('private', 'public') THEN
    RAISE EXCEPTION 'Invalid group visibility';
  END IF;
  IF COALESCE(p_daily_goal_minutes, 0) NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'Daily goal must be between 1 and 1440 minutes';
  END IF;
  IF COALESCE(p_max_members, 0) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Member limit must be between 2 and 100';
  END IF;

  INSERT INTO public.study_groups (
    owner_id, name, description, rules, target_exam, daily_goal_minutes,
    max_members, visibility, icon_key, join_code
  )
  VALUES (
    (SELECT auth.uid()), btrim(p_name), COALESCE(p_description, ''), COALESCE(p_rules, ''),
    upper(COALESCE(NULLIF(btrim(p_target_exam), ''), 'OTHER')), p_daily_goal_minutes,
    p_max_members, COALESCE(p_visibility, 'private'), COALESCE(NULLIF(btrim(p_icon_key), ''), 'books'), v_join_code
  )
  RETURNING study_groups.id INTO v_group_id;

  INSERT INTO public.study_group_members (group_id, user_id, role, status, icon_key, approved_at)
  VALUES (v_group_id, (SELECT auth.uid()), 'owner', 'approved', COALESCE(NULLIF(btrim(p_icon_key), ''), 'books'), now());

  INSERT INTO public.study_group_invites (group_id, token, created_by)
  VALUES (v_group_id, v_invite_token, (SELECT auth.uid()));

  RETURN QUERY
  SELECT g.id, g.name, g.description, g.rules, g.target_exam, g.daily_goal_minutes,
         g.max_members, g.visibility, g.icon_key, g.join_code, i.token, g.created_at
  FROM public.study_groups AS g
  JOIN public.study_group_invites AS i ON i.group_id = g.id AND i.token = v_invite_token
  WHERE g.id = v_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_study_groups(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
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
SET search_path = public, auth, pg_catalog
AS $$
  SELECT g.id, g.name, g.description, g.target_exam, g.daily_goal_minutes,
         g.max_members, g.visibility, g.icon_key, g.join_code,
         COUNT(m.id) FILTER (WHERE m.status = 'approved') AS member_count,
         g.created_at
  FROM public.study_groups AS g
  LEFT JOIN public.study_group_members AS m ON m.group_id = g.id
  WHERE g.visibility = 'public'
    AND g.status = 'active'
    AND (
      btrim(COALESCE(p_query, '')) = ''
      OR lower(g.name) LIKE '%' || lower(btrim(p_query)) || '%'
      OR lower(g.join_code) = lower(btrim(p_query))
      OR lower(g.target_exam) LIKE '%' || lower(btrim(p_query)) || '%'
    )
  GROUP BY g.id
  ORDER BY g.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 30);
$$;

CREATE OR REPLACE FUNCTION public.get_study_group_by_invite(p_token text)
RETURNS TABLE(
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
SET search_path = public, auth, pg_catalog
AS $$
  SELECT g.id, g.name, g.description, g.rules, g.target_exam, g.daily_goal_minutes,
         g.max_members, g.visibility, g.icon_key,
         COUNT(m.id) FILTER (WHERE m.status = 'approved') AS member_count,
         true AS invite_valid
  FROM public.study_group_invites AS i
  JOIN public.study_groups AS g ON g.id = i.group_id
  LEFT JOIN public.study_group_members AS m ON m.group_id = g.id
  WHERE i.token = btrim(COALESCE(p_token, ''))
    AND i.revoked_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now())
    AND g.status = 'active'
  GROUP BY g.id;
$$;

CREATE OR REPLACE FUNCTION public.join_study_group(p_group_id uuid, p_invite_token text DEFAULT NULL)
RETURNS TABLE(membership_id uuid, group_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_group public.study_groups%ROWTYPE;
  v_status text;
  v_membership public.study_group_members%ROWTYPE;
  v_existing boolean := false;
  v_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_group FROM public.study_groups WHERE id = p_group_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Study group not found'; END IF;
  IF v_group.visibility = 'private' AND NOT (SELECT private.valid_study_group_invite(p_group_id, p_invite_token)) THEN
    RAISE EXCEPTION 'A valid invite link is required for this private group';
  END IF;

  SELECT * INTO v_membership FROM public.study_group_members
  WHERE group_id = p_group_id AND user_id = (SELECT auth.uid());
  v_existing := FOUND;
  IF v_existing AND v_membership.status = 'approved' THEN
    RETURN QUERY SELECT v_membership.id, v_membership.group_id, v_membership.status;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_count FROM public.study_group_members
  WHERE group_id = p_group_id AND status IN ('pending', 'approved');
  IF v_count >= v_group.max_members THEN RAISE EXCEPTION 'This study group is full'; END IF;

  v_status := CASE WHEN v_group.visibility = 'public' THEN 'approved' ELSE 'pending' END;
  IF v_existing THEN
    UPDATE public.study_group_members
    SET status = v_status, joined_at = now(), approved_at = CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
    WHERE id = v_membership.id
    RETURNING * INTO v_membership;
  ELSE
    INSERT INTO public.study_group_members (group_id, user_id, status, icon_key, approved_at)
    VALUES (p_group_id, (SELECT auth.uid()), v_status, 'books', CASE WHEN v_status = 'approved' THEN now() ELSE NULL END)
    RETURNING * INTO v_membership;
  END IF;
  RETURN QUERY SELECT v_membership.id, v_membership.group_id, v_membership.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_study_group_member(p_membership_id uuid, p_status text)
RETURNS TABLE(membership_id uuid, group_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_membership public.study_group_members%ROWTYPE;
  v_count integer;
  v_limit integer;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid membership decision'; END IF;
  SELECT * INTO v_membership FROM public.study_group_members WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership request not found'; END IF;
  IF NOT (SELECT private.is_study_group_admin(v_membership.group_id)) THEN RAISE EXCEPTION 'Group admin access required'; END IF;
  IF v_membership.role = 'owner' THEN RAISE EXCEPTION 'The group owner cannot be changed'; END IF;
  IF p_status = 'approved' THEN
    SELECT max_members INTO v_limit FROM public.study_groups WHERE id = v_membership.group_id;
    SELECT COUNT(*)::integer INTO v_count FROM public.study_group_members
    WHERE group_id = v_membership.group_id AND status = 'approved';
    IF v_count >= v_limit THEN RAISE EXCEPTION 'This study group is full'; END IF;
  END IF;
  UPDATE public.study_group_members
  SET status = p_status, approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END
  WHERE id = p_membership_id
  RETURNING id, group_id, status INTO membership_id, group_id, status;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_study_group_icon(p_group_id uuid, p_icon_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF NOT (SELECT private.is_study_group_member(p_group_id)) THEN RAISE EXCEPTION 'Approved group membership required'; END IF;
  IF COALESCE(p_icon_key, '') !~ '^[a-z0-9_-]{2,40}$' THEN RAISE EXCEPTION 'Invalid study icon'; END IF;
  UPDATE public.study_group_members
  SET icon_key = p_icon_key
  WHERE group_id = p_group_id AND user_id = (SELECT auth.uid()) AND status = 'approved';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.study_group_members
  WHERE group_id = p_group_id AND user_id = (SELECT auth.uid());
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'owner' THEN RAISE EXCEPTION 'The group owner must archive the group or transfer ownership'; END IF;
  DELETE FROM public.study_group_members WHERE group_id = p_group_id AND user_id = (SELECT auth.uid());
  DELETE FROM public.study_group_presence WHERE group_id = p_group_id AND user_id = (SELECT auth.uid());
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_study_group_invite(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_token text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF NOT (SELECT private.is_study_group_admin(p_group_id)) THEN RAISE EXCEPTION 'Group admin access required'; END IF;
  UPDATE public.study_group_invites SET revoked_at = now()
  WHERE group_id = p_group_id AND revoked_at IS NULL;
  INSERT INTO public.study_group_invites (group_id, token, created_by)
  VALUES (p_group_id, v_token, (SELECT auth.uid()));
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF NOT (SELECT private.is_study_group_admin(p_group_id)) THEN RAISE EXCEPTION 'Group admin access required'; END IF;
  UPDATE public.study_groups SET status = 'archived', updated_at = now() WHERE id = p_group_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_study_group_report(
  p_report_id uuid,
  p_status text,
  p_resolution text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF p_status NOT IN ('pending', 'reviewed', 'actioned', 'dismissed') THEN RAISE EXCEPTION 'Invalid report status'; END IF;
  SELECT group_id INTO v_group_id FROM public.study_group_reports WHERE id = p_report_id;
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF NOT (SELECT private.is_study_group_admin(v_group_id)) THEN RAISE EXCEPTION 'Group admin access required'; END IF;
  UPDATE public.study_group_reports
  SET status = p_status, resolution = COALESCE(p_resolution, ''), reviewed_by = (SELECT auth.uid()), reviewed_at = now()
  WHERE id = p_report_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_study_group_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  UPDATE public.study_group_tickets
  SET status = 'closed', updated_at = now()
  WHERE id = p_ticket_id AND (user_id = (SELECT auth.uid()) OR (SELECT private.is_padhai_owner()));
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.create_study_group(text, text, text, text, integer, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_study_groups(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_study_group_by_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_study_group_member(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_study_group_icon(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_study_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_study_group_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_study_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_study_group_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_study_group_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_study_group(text, text, text, text, integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_study_groups(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_study_group_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_study_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_study_group_icon(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_study_group_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_study_group_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_study_group_ticket(uuid) TO authenticated;

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_tickets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.study_groups, public.study_group_members, public.study_group_invites,
  public.study_group_presence, public.study_group_sessions, public.study_group_reports,
  public.study_group_tickets FROM PUBLIC, anon;
GRANT SELECT ON public.study_groups, public.study_group_members, public.study_group_invites,
  public.study_group_presence, public.study_group_sessions, public.study_group_reports,
  public.study_group_tickets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.study_group_presence TO authenticated;
GRANT INSERT ON public.study_group_sessions, public.study_group_reports, public.study_group_tickets TO authenticated;

DROP POLICY IF EXISTS study_groups_member_select ON public.study_groups;
CREATE POLICY study_groups_member_select
  ON public.study_groups FOR SELECT TO authenticated
  USING (
    (SELECT private.is_padhai_owner())
    OR (status = 'active' AND visibility = 'public')
    OR (SELECT private.is_study_group_member(id))
    OR (SELECT private.is_study_group_admin(id))
  );

DROP POLICY IF EXISTS study_group_members_scoped_select ON public.study_group_members;
CREATE POLICY study_group_members_scoped_select
  ON public.study_group_members FOR SELECT TO authenticated
  USING (
    (SELECT private.is_padhai_owner())
    OR (SELECT private.is_study_group_admin(group_id))
    OR user_id = (SELECT auth.uid())
    OR (SELECT private.is_study_group_member(group_id))
  );

DROP POLICY IF EXISTS study_group_invites_admin_select ON public.study_group_invites;
CREATE POLICY study_group_invites_admin_select
  ON public.study_group_invites FOR SELECT TO authenticated
  USING ((SELECT private.is_padhai_owner()) OR (SELECT private.is_study_group_admin(group_id)));

DROP POLICY IF EXISTS study_group_presence_scoped_select ON public.study_group_presence;
CREATE POLICY study_group_presence_scoped_select
  ON public.study_group_presence FOR SELECT TO authenticated
  USING (
    (SELECT private.is_padhai_owner())
    OR (SELECT private.is_study_group_admin(group_id))
    OR (SELECT private.is_study_group_member(group_id))
  );
DROP POLICY IF EXISTS study_group_presence_owner_write ON public.study_group_presence;
CREATE POLICY study_group_presence_owner_write
  ON public.study_group_presence FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT private.is_study_group_member(group_id)))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT private.is_study_group_member(group_id)));

DROP POLICY IF EXISTS study_group_sessions_scoped_select ON public.study_group_sessions;
CREATE POLICY study_group_sessions_scoped_select
  ON public.study_group_sessions FOR SELECT TO authenticated
  USING (
    (SELECT private.is_padhai_owner())
    OR (SELECT private.is_study_group_admin(group_id))
    OR (SELECT private.is_study_group_member(group_id))
  );
DROP POLICY IF EXISTS study_group_sessions_owner_insert ON public.study_group_sessions;
CREATE POLICY study_group_sessions_owner_insert
  ON public.study_group_sessions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT private.is_study_group_member(group_id))
    AND (
      focus_session_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.focus_sessions
        WHERE focus_sessions.id = study_group_sessions.focus_session_id
          AND focus_sessions.user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS study_group_reports_scoped_select ON public.study_group_reports;
CREATE POLICY study_group_reports_scoped_select
  ON public.study_group_reports FOR SELECT TO authenticated
  USING (
    (SELECT private.is_padhai_owner())
    OR reporter_id = (SELECT auth.uid())
    OR (SELECT private.is_study_group_admin(group_id))
  );
DROP POLICY IF EXISTS study_group_reports_member_insert ON public.study_group_reports;
CREATE POLICY study_group_reports_member_insert
  ON public.study_group_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()) AND (SELECT private.is_study_group_member(group_id)));

DROP POLICY IF EXISTS study_group_tickets_scoped_select ON public.study_group_tickets;
CREATE POLICY study_group_tickets_scoped_select
  ON public.study_group_tickets FOR SELECT TO authenticated
  USING ((SELECT private.is_padhai_owner()) OR user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_group_tickets_owner_insert ON public.study_group_tickets;
CREATE POLICY study_group_tickets_owner_insert
  ON public.study_group_tickets FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (group_id IS NULL OR (SELECT private.is_study_group_member(group_id)))
    AND (
      report_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.study_group_reports
        WHERE study_group_reports.id = study_group_tickets.report_id
          AND study_group_reports.reporter_id = (SELECT auth.uid())
      )
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'study_groups') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.study_groups;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'study_group_members') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_members;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'study_group_presence') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_presence;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'study_group_sessions') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'study_group_reports') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_reports;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'study_group_tickets') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_tickets;
    END IF;
  END IF;
END;
$$;

COMMIT;
