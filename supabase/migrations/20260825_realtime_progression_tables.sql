-- Publish server-authoritative progression changes for live XP/streak refresh.
-- This migration does not change reward calculation, RLS, auth, or password settings.

BEGIN;

ALTER PUBLICATION supabase_realtime
  ADD TABLE public.users,
             public.focus_sessions,
             public.daily_summary,
             public.xp_transactions;

COMMIT;
