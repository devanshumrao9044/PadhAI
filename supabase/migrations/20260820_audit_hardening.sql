-- Security and scope hardening confirmed by the 2026-08-20 GitHub + Supabase audit.
-- 1) Keep level-wise leaderboard responses bounded to the product requirement.
-- 2) Remove the unused SECURITY DEFINER full-database export RPC.
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
  ORDER BY l.xp DESC, l.id
  LIMIT 30;
$function$;

REVOKE ALL ON FUNCTION public.get_level_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_level_leaderboard(integer) TO authenticated;

DROP FUNCTION IF EXISTS public.export_all_tables_to_json();

COMMIT;
