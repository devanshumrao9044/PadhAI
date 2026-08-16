-- Fix handle_new_user trigger to run as SECURITY DEFINER with proper search_path
-- and handle referral insertion safely with ON CONFLICT (referee_id).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  ref_code text;
  prefix text;
  attempts integer := 0;
  referred_by_code text := NULLIF(
    upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', ''))),
    ''
  );
  referrer_id uuid;
BEGIN
  IF referred_by_code IS NOT NULL THEN
    SELECT u.id
      INTO referrer_id
      FROM public.users AS u
     WHERE u.my_referral_code = referred_by_code
     LIMIT 1;

    IF referrer_id IS NULL OR referrer_id = new.id THEN
      RAISE EXCEPTION 'Invalid referral code';
    END IF;
  END IF;

  prefix := upper(substring(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'name', 'STU'),
      '[^a-zA-Z]', '', 'g'
    ),
    1,
    4
  ));

  IF length(prefix) < 3 THEN
    prefix := rpad(prefix, 3, 'X');
  END IF;

  LOOP
    ref_code := prefix || lpad(floor(random() * 99999)::text, 5, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1
        FROM public.users
       WHERE my_referral_code = ref_code
    );
    attempts := attempts + 1;
    EXIT WHEN attempts > 20;
  END LOOP;

  INSERT INTO public.users (id, name, email, my_referral_code, referred_by)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Student'),
    new.email,
    ref_code,
    referred_by_code
  )
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email;

  IF referrer_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referee_id, status)
    VALUES (referrer_id, new.id, 'pending')
    ON CONFLICT (referee_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$function$;

ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
