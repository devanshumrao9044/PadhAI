-- Add process_referral_bonus RPC to atomically award XP to both referee and referrer.
-- This bypasses client RLS restrictions by using SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.process_referral_bonus(p_referee_id uuid)
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
  -- 1. Check for a pending referral for this user.
  SELECT id, referrer_id INTO v_referral_id, v_referrer_id
    FROM public.referrals
   WHERE referee_id = p_referee_id
     AND status = 'pending'
   LIMIT 1;

  IF v_referral_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No pending referral found for user.');
  END IF;

  -- 2. Verify the user has at least one completed focus session.
  IF NOT EXISTS (
    SELECT 1 FROM public.focus_sessions
     WHERE user_id = p_referee_id
       AND broken = false
  ) THEN
    RETURN json_build_object('success', false, 'message', 'No completed focus session found for referee.');
  END IF;

  -- 3. Transition the referral to completed.
  -- The 'status = pending' check ensures atomicity if multiple clients call this.
  UPDATE public.referrals
     SET status = 'completed'
   WHERE id = v_referral_id
     AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Referral already processed or changed state.');
  END IF;

  -- 4. Award XP to referee.
  UPDATE public.users
     SET xp = coalesce(xp, 0) + v_xp_referee
   WHERE id = p_referee_id;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (p_referee_id, v_xp_referee, 'referral_bonus_referee');

  -- 5. Award XP to referrer.
  UPDATE public.users
     SET xp = coalesce(xp, 0) + v_xp_referrer
   WHERE id = v_referrer_id;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_referrer_id, v_xp_referrer, 'referral_bonus_referrer');

  -- 6. Check for reward threshold.
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

-- Revoke public access and grant only to authenticated users.
REVOKE ALL ON FUNCTION public.process_referral_bonus(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_referral_bonus(uuid) TO authenticated;
