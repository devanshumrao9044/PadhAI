-- Secure pending-request names for group admins and the app owner.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_pending_study_group_members(p_group_id uuid)
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
    AND (SELECT private.is_study_group_admin(p_group_id));
$$;

REVOKE ALL ON FUNCTION public.get_pending_study_group_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pending_study_group_members(uuid) TO authenticated;

COMMIT;
