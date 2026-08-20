-- Keep membership permission JSON out of direct PostgREST table reads.
-- The app reads a user's own permission row through this authenticated RPC;
-- privileged server functions continue to read the column internally.

CREATE OR REPLACE FUNCTION private.get_my_study_group_memberships()
RETURNS TABLE(
  membership_id uuid,
  group_id uuid,
  user_id uuid,
  role text,
  permissions jsonb,
  status text,
  icon_key text,
  joined_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT id, group_id, user_id, role, permissions, status, icon_key, joined_at, approved_at, created_at
  FROM public.study_group_members
  WHERE user_id = (SELECT auth.uid())
  ORDER BY created_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.get_my_study_group_memberships()
RETURNS TABLE(
  membership_id uuid,
  group_id uuid,
  user_id uuid,
  role text,
  permissions jsonb,
  status text,
  icon_key text,
  joined_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $$
  SELECT * FROM private.get_my_study_group_memberships();
$$;

REVOKE ALL ON FUNCTION private.get_my_study_group_memberships() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_my_study_group_memberships() TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_study_group_memberships() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_study_group_memberships() TO authenticated;

REVOKE SELECT (permissions) ON public.study_group_members FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.get_my_study_group_memberships() IS
  'Returns only the current user memberships, including their private permission checklist; direct permission-column reads are revoked.';
