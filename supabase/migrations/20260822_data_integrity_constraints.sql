-- PadhAI data-integrity constraints and obsolete-policy cleanup.
-- Existing historical rows were checked before this migration was applied.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Referral rows are created by the signup trigger and settled by private RPCs.
DROP POLICY IF EXISTS referrals_insert_referee ON public.referrals;
DROP POLICY IF EXISTS referrals_update_referee ON public.referrals;

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_xp_nonnegative') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_xp_nonnegative CHECK (COALESCE(xp, 0) >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_level_range') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_level_range CHECK (COALESCE(level, 1) BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_streak_nonnegative') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_streak_nonnegative CHECK (COALESCE(streak, 0) >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_longest_streak_nonnegative') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_longest_streak_nonnegative CHECK (COALESCE(longest_streak, 0) >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_total_focus_minutes_nonnegative') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_total_focus_minutes_nonnegative CHECK (COALESCE(total_focus_minutes, 0) >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_daily_goal_minutes_range') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_daily_goal_minutes_range CHECK (COALESCE(daily_goal_minutes, 120) BETWEEN 1 AND 1440);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_duration_bounds') THEN
    ALTER TABLE public.focus_sessions ADD CONSTRAINT focus_sessions_duration_bounds CHECK (
      planned_minutes BETWEEN 1 AND 1440
      AND actual_minutes BETWEEN 0 AND 1440
      AND xp_earned >= 0
      AND xp_deducted >= 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_state_consistency') THEN
    ALTER TABLE public.focus_sessions ADD CONSTRAINT focus_sessions_state_consistency CHECK (completed IS DISTINCT FROM broken OR completed = (NOT broken));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_summary_nonnegative_totals') THEN
    ALTER TABLE public.daily_summary ADD CONSTRAINT daily_summary_nonnegative_totals CHECK (
      total_focus_minutes >= 0
      AND sessions_completed >= 0
      AND sessions_broken >= 0
      AND xp_earned >= 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'xp_transactions_amount_bounds') THEN
    ALTER TABLE public.xp_transactions ADD CONSTRAINT xp_transactions_amount_bounds CHECK (amount BETWEEN -100000 AND 100000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_no_self_referral') THEN
    ALTER TABLE public.referrals ADD CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referee_id);
  END IF;
END;
$block$;

COMMIT;
