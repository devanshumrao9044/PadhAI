-- Secure member summary for Study Groups. It exposes only the fields needed inside an approved group.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  role text,
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
    m.icon_key,
    COALESCE(p.status, 'offline'),
    p.started_at,
    p.last_seen_at,
    COALESCE(SUM(
      CASE
        WHEN s.completed = true
         AND s.started_at >= date_trunc('day', now())
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
  GROUP BY m.id, m.user_id, u.name, u.avatar_url, m.role, m.icon_key,
           p.status, p.started_at, p.last_seen_at
  ORDER BY
    CASE COALESCE(p.status, 'offline')
      WHEN 'studying' THEN 0
      WHEN 'paused' THEN 1
      ELSE 2
    END,
    COALESCE(SUM(
      CASE
        WHEN s.completed = true
         AND s.started_at >= date_trunc('day', now())
        THEN s.actual_minutes
        ELSE 0
      END
    ), 0)::bigint DESC,
    MIN(m.joined_at) ASC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_study_group_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_study_group_members(uuid) TO authenticated;

COMMIT;
