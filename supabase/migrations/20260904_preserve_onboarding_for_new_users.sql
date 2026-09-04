-- Keep new auth-created profiles in onboarding until the user explicitly completes it.
-- Provider display names are presentation metadata, not proof of onboarding completion.

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
  profile_name text := 'Student';
  profile_avatar text := coalesce(
    NULLIF(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(btrim(new.raw_user_meta_data->>'picture'), ''),
    ''
  );
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
    regexp_replace(coalesce(NULLIF(btrim(new.raw_user_meta_data->>'name'), ''), 'Student'), '[^a-zA-Z]', '', 'g'),
    1,
    4
  ));

  IF length(prefix) < 3 THEN
    prefix := rpad(prefix, 3, 'X');
  END IF;

  LOOP
    ref_code := prefix || lpad(floor(random() * 99999)::text, 5, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users WHERE my_referral_code = ref_code
    );
    attempts := attempts + 1;
    EXIT WHEN attempts > 20;
  END LOOP;

  INSERT INTO public.users (
    id,
    name,
    email,
    photo_url,
    avatar_url,
    my_referral_code,
    referred_by
  )
  VALUES (
    new.id,
    profile_name,
    new.email,
    profile_avatar,
    NULLIF(profile_avatar, ''),
    ref_code,
    referrer_id
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        photo_url = CASE
          WHEN coalesce(public.users.photo_url, '') = '' THEN EXCLUDED.photo_url
          ELSE public.users.photo_url
        END,
        avatar_url = CASE
          WHEN coalesce(public.users.avatar_url, '') IS NULL OR public.users.avatar_url = '' THEN EXCLUDED.avatar_url
          ELSE public.users.avatar_url
        END;

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

REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
