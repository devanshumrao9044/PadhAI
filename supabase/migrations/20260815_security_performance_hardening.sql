-- PadhAI / Supabase security and performance hardening
--
-- IMPORTANT:
--   * Review this migration against the production project before applying it.
--   * This file is intentionally NOT executed by the application or by this audit.
--   * The migration assumes the public tables and function signatures found in the
--     Padh AI project sligrtvwosldwhlnfyen.
--   * The active app uses authenticated sessions for profile/data access and for
--     applying a referral code after signup. The archived legacy auth screens that
--     query public.users directly by email/referral code should not be re-enabled
--     without replacing those reads with a narrow RPC.
--
-- Supabase guidance:
--   RLS policies should wrap auth.uid() as (select auth.uid()) so it is evaluated
--   once per statement rather than once per row.
--   SECURITY DEFINER functions should use a fixed search_path and only receive the
--   minimum required EXECUTE privileges.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ============================================================================
-- 1. Cover the foreign keys used by user-scoped reads, updates, and deletes.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_blocked_apps_user_id
  ON public.blocked_apps (user_id);

CREATE INDEX IF NOT EXISTS idx_subjects_user_id
  ON public.subjects (user_id);

CREATE INDEX IF NOT EXISTS idx_chapters_user_id
  ON public.chapters (user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id
  ON public.focus_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_daily_summary_user_id
  ON public.daily_summary (user_id);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id
  ON public.xp_transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id
  ON public.referrals (referrer_id);

CREATE INDEX IF NOT EXISTS idx_users_referred_by
  ON public.users (referred_by);

-- The existing unique indexes already cover these access patterns:
--   daily_summary(user_id, date)
--   referrals(referee_id)
-- Therefore no duplicate index is created for them.

-- ============================================================================
-- 2. Remove broad/duplicated policies and recreate one owner-scoped policy set.
--    These policies retain the current app behavior for authenticated users while
--    preventing anonymous access to user data.
-- ============================================================================

-- blocked_apps
DROP POLICY IF EXISTS "blocked_apps_own_data" ON public.blocked_apps;
CREATE POLICY "blocked_apps_owner" ON public.blocked_apps
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- subjects
DROP POLICY IF EXISTS "Allow user to delete their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow user to insert their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow user to update their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow user to view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow users to delete their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow users to update their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Subjects Master Policy" ON public.subjects;

CREATE POLICY "subjects_select_owner" ON public.subjects
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND is_deleted = false);

CREATE POLICY "subjects_insert_owner" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "subjects_update_owner" ON public.subjects
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "subjects_delete_owner" ON public.subjects
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- chapters
DROP POLICY IF EXISTS "Allow users to delete their own chapters" ON public.chapters;
DROP POLICY IF EXISTS "Allow users to update their own chapters" ON public.chapters;
DROP POLICY IF EXISTS "Chapters Master Policy" ON public.chapters;
DROP POLICY IF EXISTS "chapters_own_data" ON public.chapters;

CREATE POLICY "chapters_owner" ON public.chapters
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- focus_sessions
DROP POLICY IF EXISTS "Focus Sessions Master Policy" ON public.focus_sessions;
DROP POLICY IF EXISTS "sessions_own_data" ON public.focus_sessions;

CREATE POLICY "focus_sessions_owner" ON public.focus_sessions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- daily_summary
DROP POLICY IF EXISTS "Daily Summary Master Policy" ON public.daily_summary;
DROP POLICY IF EXISTS "summary_own_data" ON public.daily_summary;

CREATE POLICY "daily_summary_owner" ON public.daily_summary
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- xp_transactions
DROP POLICY IF EXISTS "XP Transactions Master Policy" ON public.xp_transactions;
DROP POLICY IF EXISTS "xp_own_data" ON public.xp_transactions;

CREATE POLICY "xp_transactions_owner" ON public.xp_transactions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- referrals
DROP POLICY IF EXISTS "Users can insert referral on signup" ON public.referrals;
DROP POLICY IF EXISTS "Users can update own referral" ON public.referrals;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "referrals_insert" ON public.referrals;
DROP POLICY IF EXISTS "referrals_select" ON public.referrals;
DROP POLICY IF EXISTS "referrals_update" ON public.referrals;

CREATE POLICY "referrals_insert_referee" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = referee_id);

CREATE POLICY "referrals_select_participant" ON public.referrals
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = referrer_id OR (select auth.uid()) = referee_id);

CREATE POLICY "referrals_update_referee" ON public.referrals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = referee_id)
  WITH CHECK ((select auth.uid()) = referee_id);

-- users
-- This removes the dangerous anonymous predicate `true` from
-- "Anyone can check email exists". RLS is row-level and cannot safely expose only
-- the email column; callers that need email existence should use a dedicated,
-- boolean-only RPC instead of selecting from public.users.
DROP POLICY IF EXISTS "Anyone can check email exists" ON public.users;
DROP POLICY IF EXISTS "Enable all access for users" ON public.users;
DROP POLICY IF EXISTS "Users Master Policy" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "users_own_data" ON public.users;

CREATE POLICY "users_owner" ON public.users
  FOR ALL TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Keep RLS explicitly enabled on every exposed app table.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_apps ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Lock down SECURITY DEFINER functions and make their name resolution safe.
-- ============================================================================

-- These functions are not called by the active client and must not be exposed
-- through the public PostgREST API. Revoking PUBLIC also removes inherited access
-- for anon and authenticated.
REVOKE ALL ON FUNCTION public.export_all_tables_to_json() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_xp(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Referral-code lookup is needed by the active app only after signup has produced
-- an authenticated session. Anonymous execution is removed; the function returns
-- only a UUID and does not expose the users table.
REVOKE ALL ON FUNCTION public.get_referrer_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer_id(text) TO authenticated;

ALTER FUNCTION public.export_all_tables_to_json()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.add_xp(uuid, integer, text)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_referrer_id(text)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.rls_auto_enable()
  SET search_path = pg_catalog;

-- ============================================================================
-- 4. Expose a narrow, authenticated leaderboard contract.
--
-- The old RPC was invoker-security and therefore saw only the caller's own row
-- under owner-scoped users RLS. This view exposes only intended leaderboard fields,
-- is not selectable by anon, and lets the existing RPC return the level field the
-- client contract expects.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_leaderboard();
DROP VIEW IF EXISTS public.leaderboard_public;

CREATE VIEW public.leaderboard_public
WITH (security_barrier = true)
AS
SELECT
  u.id,
  u.name,
  u.xp,
  u.streak,
  u.avatar_url,
  COALESCE(
    (
      SELECT NULLIF(substring(t.reason FROM '"toLevelRank":([0-9]+)'), '')::integer
      FROM public.xp_transactions AS t
      WHERE t.user_id = u.id
        AND t.reason LIKE 'weekly_xp:%'
        AND substring(t.reason FROM '"toLevelRank":([0-9]+)') IS NOT NULL
      ORDER BY t.created_at DESC
      LIMIT 1
    ),
    u.level,
    1
  ) AS level
FROM public.users AS u
ORDER BY u.xp DESC, u.id;

REVOKE ALL ON public.leaderboard_public FROM PUBLIC;
GRANT SELECT ON public.leaderboard_public TO authenticated;

CREATE FUNCTION public.get_leaderboard()
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
AS $$
  SELECT
    l.id,
    l.name,
    l.xp,
    l.streak,
    l.avatar_url,
    RANK() OVER (ORDER BY l.xp DESC) AS rank,
    COALESCE(l.level, 1) AS level
  FROM public.leaderboard_public AS l
  ORDER BY l.xp DESC, l.id
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

COMMIT;

-- ============================================================================
-- 5. Post-migration verification queries (run separately after applying).
-- ============================================================================
--
-- SELECT tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- SELECT p.oid::regprocedure AS signature,
--        p.prosecdef AS security_definer,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
--        array_to_string(p.proconfig, ', ') AS config
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('add_xp', 'export_all_tables_to_json', 'get_referrer_id',
--                     'handle_new_user', 'rls_auto_enable', 'get_leaderboard')
-- LIMIT 50;
--
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
--
-- Supabase Auth leaked-password protection is not a Postgres setting. Enable it
-- separately in Dashboard -> Authentication -> Password Security.
