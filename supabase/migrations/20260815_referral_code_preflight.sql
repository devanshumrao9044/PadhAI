-- Return only whether a referral code exists. This is used before signup so
-- invalid codes are rejected before an auth account is created. It does not
-- expose the referrer's user ID or any profile data.
BEGIN;

CREATE OR REPLACE FUNCTION public.validate_referral_code(code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.users
     WHERE my_referral_code = upper(trim(code))
  );
$function$;

ALTER FUNCTION public.validate_referral_code(text)
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

COMMIT;
