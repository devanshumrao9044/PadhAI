-- Remove anonymous access to referral lookup RPCs.
-- Signup referral validation is enforced atomically by handle_new_user,
-- so the client no longer needs an anonymous preflight lookup.
BEGIN;

REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.validate_referral_code(text) SET search_path = pg_catalog, public;

-- The active signup trigger resolves referral codes server-side. Keep the
-- helper unavailable through the public API until a future authenticated flow
-- explicitly needs it.
REVOKE ALL ON FUNCTION public.get_referrer_id(text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.get_referrer_id(text) SECURITY INVOKER;
ALTER FUNCTION public.get_referrer_id(text) SET search_path = pg_catalog, public, private;

COMMIT;
