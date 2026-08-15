-- PadhAI remaining Supabase security hardening
-- Apply only after reviewing the live definitions and dependent app contracts.
-- This migration does not modify application data.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Views created by postgres bypass underlying RLS unless security_invoker=true.
-- The leaderboard RPC is already authenticated-only; keep the view private to the
-- authenticated role and make it obey the caller's RLS policies.
ALTER VIEW public.leaderboard_public SET (security_invoker = true);
REVOKE ALL ON public.leaderboard_public FROM PUBLIC, anon;
GRANT SELECT ON public.leaderboard_public TO authenticated;

-- The referral lookup needs to read users.my_referral_code without exposing the
-- users table to the caller. Keep the SECURITY DEFINER function in a private
-- schema, fix its search_path, and expose only a UUID-returning authenticated RPC.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.get_referrer_id(code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id
  FROM public.users AS u
  WHERE u.my_referral_code = upper(trim(code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_referrer_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_referrer_id(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referrer_id(code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $$
  SELECT private.get_referrer_id(code);
$$;

REVOKE ALL ON FUNCTION public.get_referrer_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer_id(text) TO authenticated;

-- This function is called by a trigger, not by the client API. Set a fixed search
-- path and remove direct RPC execution from all API roles.
ALTER FUNCTION public.prevent_fake_xp_hack()
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.prevent_fake_xp_hack() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Verification queries:
-- SELECT c.oid::regclass, c.reloptions
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relname = 'leaderboard_public' LIMIT 1;
-- SELECT p.oid::regprocedure AS signature, p.prosecdef,
--        array_to_string(p.proconfig, ', ') AS config,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname IN ('public', 'private')
--   AND p.proname IN ('get_referrer_id', 'prevent_fake_xp_hack')
-- LIMIT 20;
