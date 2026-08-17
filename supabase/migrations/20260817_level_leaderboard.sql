-- Return the complete live leaderboard for one level, rather than a global top-100 list.
-- SECURITY INVOKER preserves the authenticated-only access of leaderboard_public.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_level_leaderboard(p_level integer)
RETURNS TABLE(
  id uuid,
  name text,
  xp integer,
  streak integer,
  avatar_url text,
  rank bigint,
  level integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    l.id,
    l.name,
    l.xp,
    l.streak,
    l.avatar_url,
    RANK() OVER (ORDER BY l.xp DESC) AS rank,
    COALESCE(l.level, 1) AS level
  FROM public.leaderboard_public AS l
  WHERE COALESCE(l.level, 1) = p_level
  ORDER BY l.xp DESC, l.id;
$function$;

REVOKE ALL ON FUNCTION public.get_level_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_level_leaderboard(integer) TO authenticated;

COMMIT;
