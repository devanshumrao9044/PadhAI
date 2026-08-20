-- Study Groups permission-aware co-admin management and group-only reports.
-- Permissions live on the existing membership row; no audit-log table or file storage is added.
-- Complaints remain visible and resolvable only by the PadhAI owner.

BEGIN;

ALTER TABLE public.study_group_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{"manage_join_requests":true,"remove_members":true,"manage_invites":true,"edit_group":true,"assign_co_admin":true,"edit_co_admin_permissions":true,"demote_co_admin":true}'::jsonb;

ALTER TABLE public.study_group_members
  DROP CONSTRAINT IF EXISTS study_group_members_permissions_object_check;

ALTER TABLE public.study_group_members
  ADD CONSTRAINT study_group_members_permissions_object_check
  CHECK (jsonb_typeof(permissions) = 'object');

ALTER TABLE public.study_group_reports
  DROP CONSTRAINT IF EXISTS study_group_reports_reason_code_check;

ALTER TABLE public.study_group_reports
  ADD CONSTRAINT study_group_reports_reason_code_check
  CHECK (reason_code IN (
    'spam', 'abuse', 'fake_study_time', 'inappropriate_content',
    'harassment', 'privacy', 'scam_or_fraud', 'unsafe_or_illegal_content', 'other'
  ));

CREATE INDEX IF NOT EXISTS study_group_members_group_role_status_idx
  ON public.study_group_members (group_id, role, status);

CREATE OR REPLACE FUNCTION private.default_study_group_permissions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{"manage_join_requests":true,"remove_members":true,"manage_invites":true,"edit_group":true,"assign_co_admin":true,"edit_co_admin_permissions":true,"demote_co_admin":true}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION private.has_study_group_permission(
  p_group_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_role text;
  v_permissions jsonb;
BEGIN
  IF (SELECT private.is_padhai_owner()) THEN
    RETURN true;
  END IF;

  SELECT role, permissions
  INTO v_role, v_permissions
  FROM public.study_group_members
  WHERE group_id = p_group_id
    AND user_id = (SELECT auth.uid())
    AND status = 'approved';

  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  IF v_role <> 'admin' THEN
    RETURN false;
  END IF;

  RETURN COALESCE((v_permissions ->> p_permission)::boolean, false);
END;
$$;

CREATE OR REPLACE FUNCTION private.normalize_study_group_permissions(p_permissions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_permissions jsonb := COALESCE(p_permissions, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(v_permissions) <> 'object' THEN
    RAISE EXCEPTION 'Permissions must be a JSON object';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(v_permissions) AS permission_key
    WHERE permission_key <> ALL (ARRAY[
      'manage_join_requests', 'remove_members', 'manage_invites',
      'edit_group', 'assign_co_admin', 'edit_co_admin_permissions', 'demote_co_admin'
    ])
  ) THEN
    RAISE EXCEPTION 'Unknown Study Group permission';
  END IF;

  RETURN jsonb_build_object(
    'manage_join_requests', COALESCE((v_permissions ->> 'manage_join_requests')::boolean, false),
    'remove_members', COALESCE((v_permissions ->> 'remove_members')::boolean, false),
    'manage_invites', COALESCE((v_permissions ->> 'manage_invites')::boolean, false),
    'edit_group', COALESCE((v_permissions ->> 'edit_group')::boolean, false),
    'assign_co_admin', COALESCE((v_permissions ->> 'assign_co_admin')::boolean, false),
    'edit_co_admin_permissions', COALESCE((v_permissions ->> 'edit_co_admin_permissions')::boolean, false),
    'demote_co_admin', COALESCE((v_permissions ->> 'demote_co_admin')::boolean, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.default_study_group_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_study_group_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.normalize_study_group_permissions(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_study_group_permission(uuid, text) TO authenticated;

UPDATE public.study_group_members
SET permissions = private.default_study_group_permissions()
WHERE role = 'admin'
  AND permissions = '{}'::jsonb;

CREATE OR REPLACE FUNCTION private.get_pending_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  icon_key text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT m.id, m.user_id, COALESCE(NULLIF(btrim(u.name), ''), 'Student'), m.icon_key, m.created_at
  FROM public.study_group_members AS m
  JOIN public.users AS u ON u.id = m.user_id
  WHERE m.group_id = p_group_id
    AND m.status = 'pending'
    AND (SELECT private.has_study_group_permission(p_group_id, 'manage_join_requests'));
$$;

DROP FUNCTION IF EXISTS public.get_study_group_members(uuid);
DROP FUNCTION IF EXISTS private.get_study_group_members(uuid);

CREATE OR REPLACE FUNCTION private.get_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  permissions jsonb,
  icon_key text,
  presence_status text,
  presence_started_at timestamptz,
  last_seen_at timestamptz,
  today_minutes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT
    m.id,
    m.user_id,
    COALESCE(NULLIF(btrim(u.name), ''), 'Student'),
    u.avatar_url,
    m.role,
    m.permissions,
    m.icon_key,
    COALESCE(p.status, 'offline'),
    p.started_at,
    p.last_seen_at,
    COALESCE(SUM(
      CASE
        WHEN s.completed = true AND s.started_at >= date_trunc('day', now())
        THEN s.actual_minutes
        ELSE 0
      END
    ), 0)::bigint
  FROM public.study_group_members AS m
  JOIN public.users AS u ON u.id = m.user_id
  LEFT JOIN public.study_group_presence AS p
    ON p.group_id = m.group_id AND p.user_id = m.user_id
  LEFT JOIN public.study_group_sessions AS s
    ON s.group_id = m.group_id AND s.user_id = m.user_id
  WHERE m.group_id = p_group_id
    AND m.status = 'approved'
    AND (
      (SELECT private.is_padhai_owner())
      OR (SELECT private.is_study_group_member(p_group_id))
      OR (SELECT private.is_study_group_admin(p_group_id))
    )
  GROUP BY m.id, m.user_id, u.name, u.avatar_url, m.role, m.permissions, m.icon_key,
           p.status, p.started_at, p.last_seen_at
  ORDER BY
    CASE COALESCE(p.status, 'offline')
      WHEN 'studying' THEN 0
      WHEN 'paused' THEN 1
      ELSE 2
    END,
    COALESCE(SUM(
      CASE
        WHEN s.completed = true AND s.started_at >= date_trunc('day', now())
        THEN s.actual_minutes
        ELSE 0
      END
    ), 0)::bigint DESC,
    MIN(m.joined_at) ASC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION private.review_study_group_member(p_membership_id uuid, p_status text)
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
  IF NOT (SELECT private.has_study_group_permission(v_membership.group_id, 'manage_join_requests')) THEN
    RAISE EXCEPTION 'Join-request permission required';
  END IF;
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

CREATE OR REPLACE FUNCTION private.create_study_group_invite(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_token text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF NOT (SELECT private.has_study_group_permission(p_group_id, 'manage_invites')) THEN
    RAISE EXCEPTION 'Invite-management permission required';
  END IF;
  UPDATE public.study_group_invites SET revoked_at = now()
  WHERE group_id = p_group_id AND revoked_at IS NULL;
  INSERT INTO public.study_group_invites (group_id, token, created_by)
  VALUES (p_group_id, v_token, (SELECT auth.uid()));
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION private.archive_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF NOT (
    (SELECT private.is_padhai_owner())
    OR EXISTS (
      SELECT 1 FROM public.study_groups
      WHERE id = p_group_id AND owner_id = (SELECT auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Only the group owner can archive this group';
  END IF;
  UPDATE public.study_groups SET status = 'archived', updated_at = now() WHERE id = p_group_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_study_group_member_role(
  p_membership_id uuid,
  p_role text,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_target public.study_group_members%ROWTYPE;
  v_actor public.study_group_members%ROWTYPE;
  v_next_permissions jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Only member or co-admin roles are assignable'; END IF;

  SELECT * INTO v_target FROM public.study_group_members WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_target.status <> 'approved' THEN RAISE EXCEPTION 'Only approved members can be managed'; END IF;
  IF v_target.role = 'owner' THEN RAISE EXCEPTION 'The group owner cannot be changed'; END IF;
  IF v_target.user_id = (SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot change your own group role'; END IF;

  SELECT * INTO v_actor FROM public.study_group_members
  WHERE group_id = v_target.group_id
    AND user_id = (SELECT auth.uid())
    AND status = 'approved';

  IF NOT (SELECT private.is_padhai_owner()) THEN
    IF v_actor.role = 'owner' THEN
      NULL;
    ELSIF v_actor.role = 'admin' AND p_role = 'admin' AND v_target.role = 'member' THEN
      IF NOT (SELECT private.has_study_group_permission(v_target.group_id, 'assign_co_admin')) THEN
        RAISE EXCEPTION 'Co-admin assignment permission required';
      END IF;
    ELSIF v_actor.role = 'admin' AND p_role = 'admin' AND v_target.role = 'admin' THEN
      IF NOT (SELECT private.has_study_group_permission(v_target.group_id, 'edit_co_admin_permissions')) THEN
        RAISE EXCEPTION 'Co-admin permission-edit permission required';
      END IF;
    ELSIF v_actor.role = 'admin' AND p_role = 'member' AND v_target.role = 'admin' THEN
      IF NOT (SELECT private.has_study_group_permission(v_target.group_id, 'demote_co_admin')) THEN
        RAISE EXCEPTION 'Co-admin demotion permission required';
      END IF;
    ELSE
      RAISE EXCEPTION 'Insufficient rank or permission';
    END IF;
  END IF;

  v_next_permissions := CASE
    WHEN p_role = 'admin' THEN private.normalize_study_group_permissions(p_permissions)
    ELSE '{}'::jsonb
  END;

  UPDATE public.study_group_members
  SET role = p_role, permissions = v_next_permissions
  WHERE id = v_target.id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.remove_study_group_member(p_membership_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_target public.study_group_members%ROWTYPE;
BEGIN
  SELECT * INTO v_target FROM public.study_group_members WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_target.role = 'owner' THEN RAISE EXCEPTION 'The group owner cannot be removed'; END IF;
  IF v_target.user_id = (SELECT auth.uid()) THEN RAISE EXCEPTION 'Use Leave group to remove yourself'; END IF;
  IF NOT (SELECT private.has_study_group_permission(v_target.group_id, 'remove_members')) THEN
    RAISE EXCEPTION 'Member-removal permission required';
  END IF;
  DELETE FROM public.study_group_presence WHERE group_id = v_target.group_id AND user_id = v_target.user_id;
  DELETE FROM public.study_group_members WHERE id = v_target.id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.submit_study_group_report(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL,
  p_reason_code text DEFAULT 'other',
  p_details text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_group public.study_groups%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_reason_code NOT IN ('spam', 'abuse', 'fake_study_time', 'inappropriate_content', 'harassment', 'privacy', 'scam_or_fraud', 'unsafe_or_illegal_content', 'other') THEN
    RAISE EXCEPTION 'Invalid report reason';
  END IF;
  IF char_length(COALESCE(p_details, '')) > 1000 THEN RAISE EXCEPTION 'Report details are too long'; END IF;

  SELECT * INTO v_group FROM public.study_groups WHERE id = p_group_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Study group not found'; END IF;

  IF NOT (
    v_group.visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM public.study_group_members
      WHERE group_id = p_group_id AND user_id = (SELECT auth.uid()) AND status IN ('pending', 'approved')
    )
    OR (SELECT private.valid_study_group_invite(p_group_id, p_invite_token))
    OR (SELECT private.is_padhai_owner())
  ) THEN
    RAISE EXCEPTION 'A public group, pending membership, or valid invite is required to report this group';
  END IF;

  INSERT INTO public.study_group_reports (group_id, reporter_id, reported_user_id, reason_code, details)
  VALUES (p_group_id, (SELECT auth.uid()), NULL, p_reason_code, btrim(COALESCE(p_details, '')));
  RETURN true;
END;
$$;

-- The old return signature was recreated above with the new permissions column.
CREATE OR REPLACE FUNCTION public.get_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  permissions jsonb,
  icon_key text,
  presence_status text,
  presence_started_at timestamptz,
  last_seen_at timestamptz,
  today_minutes bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT * FROM private.get_study_group_members(p_group_id);
$$;

CREATE OR REPLACE FUNCTION public.get_pending_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  icon_key text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT * FROM private.get_pending_study_group_members(p_group_id);
$$;

CREATE OR REPLACE FUNCTION public.review_study_group_member(p_membership_id uuid, p_status text)
RETURNS TABLE(membership_id uuid, group_id uuid, status text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT * FROM private.review_study_group_member(p_membership_id, p_status);
$$;

CREATE OR REPLACE FUNCTION public.create_study_group_invite(p_group_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT private.create_study_group_invite(p_group_id);
$$;

CREATE OR REPLACE FUNCTION public.archive_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT private.archive_study_group(p_group_id);
$$;

CREATE OR REPLACE FUNCTION public.update_study_group_member_role(
  p_membership_id uuid,
  p_role text,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT private.update_study_group_member_role(p_membership_id, p_role, p_permissions);
$$;

CREATE OR REPLACE FUNCTION public.remove_study_group_member(p_membership_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT private.remove_study_group_member(p_membership_id);
$$;

CREATE OR REPLACE FUNCTION public.submit_study_group_report(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL,
  p_reason_code text DEFAULT 'other',
  p_details text DEFAULT ''
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT private.submit_study_group_report(p_group_id, p_invite_token, p_reason_code, p_details);
$$;

REVOKE ALL ON FUNCTION private.get_pending_study_group_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_study_group_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_study_group_member(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_study_group_invite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.archive_study_group(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.update_study_group_member_role(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.remove_study_group_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_study_group_report(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_pending_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.review_study_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_study_group_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.archive_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.update_study_group_member_role(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.remove_study_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.submit_study_group_report(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_pending_study_group_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_study_group_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_study_group_member(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_study_group_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_study_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_study_group_member_role(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_study_group_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_study_group_report(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pending_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_study_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_study_group_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_study_group_member_role(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_study_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_study_group_report(uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.update_study_group_member_role(uuid, text, jsonb) IS
  'Owner or permitted co-admin can promote approved members to co-admin or edit/demote lower-rank co-admins; owner cannot be changed.';
COMMENT ON FUNCTION public.submit_study_group_report(uuid, text, text, text) IS
  'Authenticated users may report an active public group, a pending/member group, or a group reached through a valid invite; only the PadhAI owner can review.';

COMMIT;
