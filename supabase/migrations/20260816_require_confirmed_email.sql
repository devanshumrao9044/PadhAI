-- Defense-in-depth email verification enforcement.
-- The helper reads auth.users server-side and is not exposed through public RPC.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_email_confirmed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM auth.users
     WHERE id = auth.uid()
       AND email_confirmed_at IS NOT NULL
  );
$function$;

REVOKE ALL ON FUNCTION private.is_email_confirmed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_email_confirmed() TO authenticated;

DO $block$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'subjects',
    'chapters',
    'focus_sessions',
    'daily_summary',
    'xp_transactions',
    'referrals',
    'blocked_apps'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'email_confirmation_required', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((select private.is_email_confirmed())) WITH CHECK ((select private.is_email_confirmed()))',
      'email_confirmation_required',
      target_table
    );
  END LOOP;
END;
$block$;

COMMIT;
