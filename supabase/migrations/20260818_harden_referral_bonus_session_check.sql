-- Referral XP is awarded only after a completed, non-broken focus session.
-- A client must not be able to insert an incomplete row and trigger the bonus.
BEGIN;

CREATE OR REPLACE FUNCTION private.process_referral_bonus(p_referee_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_referral_id uuid;
  v_referrer_id uuid;
  v_xp_referee integer := 50;
  v_xp_referrer integer := 25;
  v_reward_threshold integer := 5;
  v_completed_count bigint;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_referee_id THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized referee.');
  END IF;

  SELECT id, referrer_id INTO v_referral_id, v_referrer_id
    FROM public.referrals
   WHERE referee_id = p_referee_id
     AND status = 'pending'
   LIMIT 1;

  IF v_referral_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No pending referral found for user.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.focus_sessions
     WHERE user_id = p_referee_id
       AND completed = true
       AND broken = false
  ) THEN
    RETURN json_build_object('success', false, 'message', 'No completed focus session found for referee.');
  END IF;

  UPDATE public.referrals
     SET status = 'completed', completed_at = now(), xp_awarded = true
   WHERE id = v_referral_id
     AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Referral already processed or changed state.');
  END IF;

  UPDATE public.users
     SET xp = coalesce(xp, 0) + v_xp_referee
   WHERE id = p_referee_id;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (p_referee_id, v_xp_referee, 'referral_bonus_referee');

  UPDATE public.users
     SET xp = coalesce(xp, 0) + v_xp_referrer
   WHERE id = v_referrer_id;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_referrer_id, v_xp_referrer, 'referral_bonus_referrer');

  SELECT count(*) INTO v_completed_count
    FROM public.referrals
   WHERE referrer_id = v_referrer_id
     AND status = 'completed';

  IF v_completed_count >= v_reward_threshold THEN
    UPDATE public.users
       SET has_unlocked_reward = true
     WHERE id = v_referrer_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'referee_xp_added', v_xp_referee,
    'referrer_xp_added', v_xp_referrer,
    'referrer_total_completed', v_completed_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.process_referral_bonus(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.process_referral_bonus(uuid) TO authenticated;

COMMIT;
