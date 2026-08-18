-- Backfill metadata only for referrals whose two bonus transaction records already
-- exist. This does not award XP and is safe to rerun for remaining gaps.
BEGIN;

WITH target AS (
  SELECT
    r.id,
    GREATEST(
      COALESCE((SELECT MIN(x.created_at) FROM public.xp_transactions x WHERE x.user_id = r.referee_id AND x.reason = 'referral_bonus_referee'), r.created_at),
      COALESCE((SELECT MIN(x.created_at) FROM public.xp_transactions x WHERE x.user_id = r.referrer_id AND x.reason = 'referral_bonus_referrer'), r.created_at),
      r.created_at
    ) AS inferred_completed_at
  FROM public.referrals r
  WHERE r.status = 'completed'
    AND (r.xp_awarded IS DISTINCT FROM true OR r.completed_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.xp_transactions x WHERE x.user_id = r.referee_id AND x.reason = 'referral_bonus_referee')
    AND EXISTS (SELECT 1 FROM public.xp_transactions x WHERE x.user_id = r.referrer_id AND x.reason = 'referral_bonus_referrer')
  ORDER BY r.created_at
  LIMIT 100
)
UPDATE public.referrals r
   SET xp_awarded = true,
       completed_at = COALESCE(r.completed_at, target.inferred_completed_at)
  FROM target
 WHERE r.id = target.id;

COMMIT;
