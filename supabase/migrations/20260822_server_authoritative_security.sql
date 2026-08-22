-- PadhAI server-authoritative security hardening.
-- This migration is forward-only. It keeps leaked-password protection unchanged.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

-- -----------------------------------------------------------------------------
-- Users: read own row and update only profile/settings columns directly.
-- Progression, referral, reward, and audit fields are server-controlled.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_owner ON public.users;
DROP POLICY IF EXISTS users_select_owner ON public.users;
DROP POLICY IF EXISTS users_update_profile_owner ON public.users;

CREATE POLICY users_select_owner
  ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY users_update_profile_owner
  ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (
  name,
  photo_url,
  target_exam,
  class,
  daily_goal_minutes,
  tone_preference,
  notification_time_morning,
  notification_time_evening,
  language,
  avatar_url,
  fcm_token
) ON public.users TO authenticated;

-- -----------------------------------------------------------------------------
-- Tracker tables: preserve the existing user-owned CRUD UX, while ensuring a
-- chapter cannot be attached to another user's subject.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS chapters_owner ON public.chapters;
DROP POLICY IF EXISTS chapters_select_owner ON public.chapters;
DROP POLICY IF EXISTS chapters_insert_owner ON public.chapters;
DROP POLICY IF EXISTS chapters_update_owner ON public.chapters;
DROP POLICY IF EXISTS chapters_delete_owner ON public.chapters;

CREATE POLICY chapters_select_owner
  ON public.chapters
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id AND COALESCE(is_deleted, false) = false);

CREATE POLICY chapters_insert_owner
  ON public.chapters
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      subject_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.id = subject_id
          AND s.user_id = (SELECT auth.uid())
          AND COALESCE(s.is_deleted, false) = false
      )
    )
  );

CREATE POLICY chapters_update_owner
  ON public.chapters
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      subject_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.id = subject_id
          AND s.user_id = (SELECT auth.uid())
          AND COALESCE(s.is_deleted, false) = false
      )
    )
  );

CREATE POLICY chapters_delete_owner
  ON public.chapters
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Progression tables: authenticated users can read their own records, but all
-- inserts/updates/deletes are performed by trusted SECURITY DEFINER functions.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS focus_sessions_owner ON public.focus_sessions;
DROP POLICY IF EXISTS focus_sessions_select_owner ON public.focus_sessions;
CREATE POLICY focus_sessions_select_owner
  ON public.focus_sessions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.focus_sessions FROM authenticated;
GRANT SELECT ON public.focus_sessions TO authenticated;

DROP POLICY IF EXISTS daily_summary_owner ON public.daily_summary;
DROP POLICY IF EXISTS daily_summary_select_owner ON public.daily_summary;
CREATE POLICY daily_summary_select_owner
  ON public.daily_summary
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.daily_summary FROM authenticated;
GRANT SELECT ON public.daily_summary TO authenticated;

DROP POLICY IF EXISTS xp_transactions_owner ON public.xp_transactions;
DROP POLICY IF EXISTS xp_transactions_select_owner ON public.xp_transactions;
CREATE POLICY xp_transactions_select_owner
  ON public.xp_transactions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.xp_transactions FROM authenticated;
GRANT SELECT ON public.xp_transactions TO authenticated;

-- Referral rows are created/settled by the signup trigger and server RPC only.
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM authenticated;
GRANT SELECT ON public.referrals TO authenticated;

-- -----------------------------------------------------------------------------
-- Notifications: device registration and read/delete actions remain user-owned;
-- notification content and admin messages are not directly writable.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_devices_owner_all ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_owner_select ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_owner_insert ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_owner_update ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_owner_delete ON public.notification_devices;

CREATE POLICY notification_devices_owner_select
  ON public.notification_devices FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY notification_devices_owner_insert
  ON public.notification_devices FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY notification_devices_owner_update
  ON public.notification_devices FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY notification_devices_owner_delete
  ON public.notification_devices FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.notification_devices FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_devices TO authenticated;

REVOKE UPDATE ON public.user_notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;
GRANT SELECT, DELETE ON public.user_notifications TO authenticated;

-- -----------------------------------------------------------------------------
-- Study groups: preserve read access and user-owned ticket creation, but keep
-- presence/session/report state changes behind server authorization.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_group_reports_member_insert ON public.study_group_reports;
DROP POLICY IF EXISTS study_group_reports_reporter_select ON public.study_group_reports;
CREATE POLICY study_group_reports_reporter_select
  ON public.study_group_reports
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reporter_id);
REVOKE INSERT, UPDATE, DELETE ON public.study_group_reports FROM authenticated;
GRANT SELECT ON public.study_group_reports TO authenticated;

DROP POLICY IF EXISTS study_group_tickets_reporter_select ON public.study_group_tickets;
CREATE POLICY study_group_tickets_reporter_select
  ON public.study_group_tickets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE UPDATE, DELETE ON public.study_group_tickets FROM authenticated;
GRANT SELECT ON public.study_group_tickets TO authenticated;
GRANT INSERT (
  user_id,
  group_id,
  report_id,
  category,
  subject,
  details
) ON public.study_group_tickets TO authenticated;

DROP POLICY IF EXISTS study_group_presence_owner_insert ON public.study_group_presence;
DROP POLICY IF EXISTS study_group_presence_owner_update ON public.study_group_presence;
DROP POLICY IF EXISTS study_group_presence_owner_delete ON public.study_group_presence;
REVOKE INSERT, UPDATE, DELETE ON public.study_group_presence FROM authenticated;
GRANT SELECT ON public.study_group_presence TO authenticated;

DROP POLICY IF EXISTS study_group_sessions_owner_insert ON public.study_group_sessions;
REVOKE INSERT, UPDATE, DELETE ON public.study_group_sessions FROM authenticated;
GRANT SELECT ON public.study_group_sessions TO authenticated;

-- -----------------------------------------------------------------------------
-- Reward popup acknowledgement: harmless UI state still uses a server-checked
-- narrow RPC rather than a broad users UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.mark_reward_popup_seen()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.users
     SET reward_popup_seen = true
   WHERE id = v_user_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION private.mark_reward_popup_seen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.mark_reward_popup_seen() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_reward_popup_seen()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.mark_reward_popup_seen();
$function$;

REVOKE ALL ON FUNCTION public.mark_reward_popup_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_reward_popup_seen() TO authenticated;

-- -----------------------------------------------------------------------------
-- Streak expiry: route guard can ask the server to settle an expired streak.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.mark_streak_broken()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_last_study_date date;
  v_streak integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('broken', false, 'conflict_code', 'auth_required');
  END IF;

  SELECT COALESCE(streak, 0), last_study_date
    INTO v_streak, v_last_study_date
    FROM public.users
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND OR v_streak <= 0 OR (v_last_study_date IS NOT NULL AND v_last_study_date >= v_today - 1) THEN
    RETURN json_build_object('broken', false, 'lost_streak', 0);
  END IF;

  UPDATE public.users
     SET streak = 0
   WHERE id = v_user_id;

  RETURN json_build_object('broken', true, 'lost_streak', v_streak);
END;
$function$;

REVOKE ALL ON FUNCTION private.mark_streak_broken() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.mark_streak_broken() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_streak_broken()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.mark_streak_broken();
$function$;

REVOKE ALL ON FUNCTION public.mark_streak_broken() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_streak_broken() TO authenticated;

-- -----------------------------------------------------------------------------
-- Weekly XP marker: the server computes rank/zone/level transition and performs
-- the weekly reset. The client supplies only the week boundary it is requesting.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.record_weekly_xp_marker(p_week_start date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_current_week_start date;
  v_marker_id uuid;
  v_existing public.xp_transactions%ROWTYPE;
  v_latest jsonb;
  v_xp integer := 0;
  v_current_level integer := 1;
  v_from_level integer := 1;
  v_to_level integer := 1;
  v_rank integer := 1;
  v_total_players integer := 1;
  v_demotion_count integer := 0;
  v_safety_count integer := 0;
  v_rank_pct numeric := 0;
  v_threshold_pct numeric := 0;
  v_zone text := NULL;
  v_kind text := 'baseline';
  v_reason text;
  v_inserted_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'auth_required');
  END IF;

  v_current_week_start := v_today - EXTRACT(DOW FROM v_today)::integer;
  IF p_week_start IS NULL OR p_week_start < v_current_week_start - 7 OR p_week_start > v_current_week_start THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'week_invalid');
  END IF;

  v_marker_id := extensions.uuid_generate_v5(
    extensions.uuid_ns_url(),
    'padhai:weekly_xp:' || v_user_id::text || ':' || p_week_start::text
  );

  SELECT * INTO v_existing
    FROM public.xp_transactions
   WHERE id = v_marker_id
   LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object(
      'accepted', true,
      'duplicate', true,
      'marker_id', v_existing.id,
      'kind', CASE WHEN v_existing.reason LIKE 'weekly_xp:%' THEN (substring(v_existing.reason FROM 11)::jsonb ->> 'kind') ELSE 'baseline' END,
      'xp_after_reset', 0
    );
  END IF;

  SELECT COALESCE(u.xp, 0), GREATEST(1, LEAST(5, COALESCE(u.level, 1)))
    INTO v_xp, v_current_level
    FROM public.users u
   WHERE u.id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'profile_not_found');
  END IF;

  SELECT substring(t.reason FROM 11)::jsonb
    INTO v_latest
    FROM public.xp_transactions t
   WHERE t.user_id = v_user_id
     AND t.reason LIKE 'weekly_xp:%'
   ORDER BY t.created_at DESC
   LIMIT 1;

  IF v_latest IS NOT NULL
     AND COALESCE((v_latest ->> 'toLevelRank') ~ '^[1-5]$', false) THEN
    v_current_level := (v_latest ->> 'toLevelRank')::integer;
  END IF;

  IF v_latest IS NOT NULL THEN
    v_kind := 'settlement';
    v_from_level := v_current_level;
    SELECT
      1 + (SELECT COUNT(*)::integer FROM public.users other WHERE COALESCE(other.xp, 0) > v_xp),
      (SELECT COUNT(*)::integer FROM public.users)
      INTO v_rank, v_total_players;
    v_total_players := GREATEST(1, v_total_players);
    v_demotion_count := FLOOR(v_total_players * 0.4)::integer;
    v_safety_count := FLOOR(v_total_players * 0.35)::integer;
    v_rank_pct := ((v_total_players - v_rank)::numeric / v_total_players::numeric) * 100;
    v_threshold_pct := ((v_demotion_count + v_safety_count)::numeric / v_total_players::numeric) * 100;
    IF v_rank_pct >= v_threshold_pct THEN
      v_zone := 'promotion';
      v_to_level := LEAST(5, v_from_level + 1);
    ELSIF v_rank_pct >= (v_demotion_count::numeric / v_total_players::numeric) * 100 THEN
      v_zone := 'safety';
      v_to_level := v_from_level;
    ELSE
      v_zone := 'demotion';
      v_to_level := GREATEST(1, v_from_level - 1);
    END IF;
  ELSE
    v_from_level := v_current_level;
    v_to_level := v_current_level;
  END IF;

  v_reason := 'weekly_xp:' || json_build_object(
    'kind', v_kind,
    'weekStart', p_week_start,
    'zone', v_zone,
    'fromLevelRank', v_from_level,
    'toLevelRank', v_to_level,
    'markerId', v_marker_id,
    'xpAfterReset', 0
  )::text;

  INSERT INTO public.xp_transactions (id, user_id, amount, reason, created_at)
  VALUES (v_marker_id, v_user_id, 0, v_reason, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN json_build_object('accepted', true, 'duplicate', true, 'marker_id', v_marker_id, 'xp_after_reset', 0);
  END IF;

  IF v_kind = 'settlement' THEN
    UPDATE public.users
       SET xp = 0,
           level = v_to_level
     WHERE id = v_user_id;
  ELSE
    UPDATE public.users
       SET level = v_to_level
     WHERE id = v_user_id;
  END IF;

  RETURN json_build_object(
    'accepted', true,
    'duplicate', false,
    'marker_id', v_marker_id,
    'kind', v_kind,
    'week_start', p_week_start,
    'zone', v_zone,
    'from_level_rank', v_from_level,
    'to_level_rank', v_to_level,
    'xp_after_reset', 0,
    'new_xp_total', CASE WHEN v_kind = 'settlement' THEN 0 ELSE v_xp END
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.record_weekly_xp_marker(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_weekly_xp_marker(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_weekly_xp_marker(p_week_start date)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.record_weekly_xp_marker(p_week_start);
$function$;

REVOKE ALL ON FUNCTION public.record_weekly_xp_marker(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_weekly_xp_marker(date) TO authenticated;

-- -----------------------------------------------------------------------------
-- Presence writes: server supplies timestamps and validates membership/session.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.update_study_group_presence(
  p_group_id uuid,
  p_session_id uuid,
  p_status text,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_started_at timestamptz := COALESCE(p_started_at, CURRENT_TIMESTAMP);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_status NOT IN ('studying', 'paused', 'offline') THEN RAISE EXCEPTION 'Invalid presence status'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.study_group_members gm
    WHERE gm.group_id = p_group_id AND gm.user_id = v_user_id AND gm.status = 'approved'
  ) THEN RAISE EXCEPTION 'Approved group membership required'; END IF;
  IF v_started_at > CURRENT_TIMESTAMP + interval '5 minutes' THEN RAISE EXCEPTION 'Presence timestamp is in the future'; END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.focus_sessions fs
    WHERE fs.id = p_session_id AND fs.user_id = v_user_id
  ) THEN RAISE EXCEPTION 'Focus session is not owned by the current user'; END IF;

  INSERT INTO public.study_group_presence (
    group_id, user_id, session_id, status, started_at, last_seen_at, updated_at
  ) VALUES (
    p_group_id, v_user_id, p_session_id, p_status, v_started_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
  ON CONFLICT (group_id, user_id) DO UPDATE SET
    session_id = EXCLUDED.session_id,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    last_seen_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION private.update_study_group_presence(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_study_group_presence(uuid, uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_study_group_presence(
  p_group_id uuid,
  p_session_id uuid,
  p_status text,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.update_study_group_presence(p_group_id, p_session_id, p_status, p_started_at);
$function$;

REVOKE ALL ON FUNCTION public.update_study_group_presence(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_study_group_presence(uuid, uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.clear_study_group_presence(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.study_group_presence
   WHERE group_id = p_group_id AND user_id = v_user_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION private.clear_study_group_presence(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.clear_study_group_presence(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_study_group_presence(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.clear_study_group_presence(p_group_id);
$function$;

REVOKE ALL ON FUNCTION public.clear_study_group_presence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_study_group_presence(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Offline focus settlement: idempotent, ownership-bound, timestamp-consistent,
-- and fully server-authoritative for session/XP/summary/streak state.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sync_offline_focus_session(
  p_session_id uuid,
  p_subject_id uuid,
  p_chapter_id uuid,
  p_study_group_id uuid,
  p_planned_minutes integer,
  p_actual_minutes integer,
  p_elapsed_seconds integer,
  p_completed boolean,
  p_broken boolean,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_clock_anomaly boolean DEFAULT false,
  p_is_recovery boolean DEFAULT false,
  p_recovery_lost_streak integer DEFAULT NULL,
  p_comeback_bonus integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_existing public.focus_sessions%ROWTYPE;
  v_inserted_id uuid;
  v_daily_goal integer;
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_yesterday date := v_today - 1;
  v_now timestamptz := statement_timestamp();
  v_wall_seconds numeric;
  v_xp integer := 0;
  v_xp_deducted integer := 0;
  v_referral_result json := '{}'::json;
  v_referral_xp integer := 0;
  v_new_xp integer := 0;
  v_new_streak integer := 0;
  v_existing_total integer := 0;
  v_existing_goal_met boolean := false;
  v_goal_met boolean := false;
  v_last_study_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'auth_required', 'message', 'Authentication required.');
  END IF;
  IF p_session_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'session_id_required', 'message', 'Session ID is required.');
  END IF;

  SELECT fs.* INTO v_existing
    FROM public.focus_sessions fs
   WHERE fs.id = p_session_id
   LIMIT 1;
  IF FOUND THEN
    IF v_existing.user_id <> v_user_id THEN
      RETURN json_build_object('accepted', false, 'conflict_code', 'session_not_owned', 'message', 'This session belongs to another account.');
    END IF;
    RETURN json_build_object(
      'accepted', true,
      'duplicate', true,
      'focus_session_id', v_existing.id,
      'verified_minutes', COALESCE(v_existing.actual_minutes, 0),
      'xp_earned', COALESCE(v_existing.xp_earned, 0),
      'xp_deducted', COALESCE(v_existing.xp_deducted, 0)
    );
  END IF;

  IF p_clock_anomaly THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'clock_changed', 'message', 'Device clock changed during the session.');
  END IF;
  IF p_completed IS DISTINCT FROM (NOT p_broken) THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'invalid_completion_state', 'message', 'The session completion state is invalid.');
  END IF;
  IF p_planned_minutes IS NULL OR p_planned_minutes NOT BETWEEN 1 AND 1440
     OR p_actual_minutes IS NULL OR p_actual_minutes NOT BETWEEN 0 AND 1440
     OR p_elapsed_seconds IS NULL OR p_elapsed_seconds NOT BETWEEN 0 AND 86400 THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'duration_invalid', 'message', 'The session duration is outside the allowed range.');
  END IF;
  IF p_completed AND p_actual_minutes < 1 THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'completed_duration_invalid', 'message', 'A completed session must contain study time.');
  END IF;
  IF p_broken AND p_actual_minutes > p_planned_minutes THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'broken_duration_invalid', 'message', 'A broken session cannot exceed its planned duration.');
  END IF;
  IF p_actual_minutes <> FLOOR(p_elapsed_seconds / 60.0)::integer THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'duration_mismatch', 'message', 'The elapsed duration does not match the session duration.');
  END IF;
  IF p_started_at IS NULL OR p_ended_at IS NULL OR p_ended_at < p_started_at THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'timestamps_invalid', 'message', 'The session timestamps are invalid.');
  END IF;
  IF p_started_at > v_now + interval '5 minutes' OR p_ended_at > v_now + interval '5 minutes' THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'timestamp_in_future', 'message', 'The session timestamp is in the future.');
  END IF;
  v_wall_seconds := EXTRACT(EPOCH FROM (p_ended_at - p_started_at));
  IF v_wall_seconds < 0 OR v_wall_seconds > 86520 OR ABS(v_wall_seconds - p_elapsed_seconds) > 120 THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'timestamp_duration_mismatch', 'message', 'The timestamps do not match the elapsed session duration.');
  END IF;
  IF p_comeback_bonus NOT IN (0, 50) OR (p_broken AND p_comeback_bonus <> 0) THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'bonus_invalid', 'message', 'The comeback bonus is invalid.');
  END IF;
  IF p_is_recovery AND p_actual_minutes < 30 THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'recovery_duration_invalid', 'message', 'A recovery session requires at least 30 minutes.');
  END IF;
  IF p_is_recovery AND COALESCE(p_recovery_lost_streak, 0) < 1 THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'recovery_state_invalid', 'message', 'The recovery state is invalid.');
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects s
     WHERE s.id = p_subject_id AND s.user_id = v_user_id AND COALESCE(s.is_deleted, false) = false
  ) THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'subject_not_owned', 'message', 'The selected subject is no longer available.');
  END IF;
  IF p_chapter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chapters c
     WHERE c.id = p_chapter_id AND c.user_id = v_user_id AND COALESCE(c.is_deleted, false) = false
  ) THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'chapter_not_owned_or_deleted', 'message', 'The selected chapter is no longer available.');
  END IF;
  IF p_chapter_id IS NOT NULL AND p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chapters c
     WHERE c.id = p_chapter_id AND c.subject_id = p_subject_id AND c.user_id = v_user_id AND COALESCE(c.is_deleted, false) = false
  ) THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'chapter_subject_mismatch', 'message', 'The selected chapter does not belong to the selected subject.');
  END IF;
  IF p_study_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.study_group_members gm
     WHERE gm.group_id = p_study_group_id AND gm.user_id = v_user_id AND gm.status = 'approved'
  ) THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'group_membership_invalid', 'message', 'The study-group membership is no longer active.');
  END IF;

  -- Serialise progression settlement per user to avoid lost XP/streak updates.
  SELECT COALESCE(u.daily_goal_minutes, 120), COALESCE(u.xp, 0), COALESCE(u.streak, 0), u.last_study_date
    INTO v_daily_goal, v_new_xp, v_new_streak, v_last_study_date
    FROM public.users u
   WHERE u.id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'profile_not_found', 'message', 'The user profile could not be found.');
  END IF;

  IF p_broken THEN
    v_xp_deducted := FLOOR(p_planned_minutes * 1.0)::integer;
  ELSE
    v_xp := FLOOR(p_actual_minutes * 2.0)::integer + p_comeback_bonus;
  END IF;

  SELECT COALESCE(ds.total_focus_minutes, 0), COALESCE(ds.goal_met, false)
    INTO v_existing_total, v_existing_goal_met
    FROM public.daily_summary ds
   WHERE ds.user_id = v_user_id AND ds.date = v_today
   LIMIT 1;
  v_goal_met := v_existing_total + p_actual_minutes >= v_daily_goal;
  IF p_completed AND NOT v_existing_goal_met AND v_goal_met THEN
    v_xp := v_xp + 50;
  END IF;

  INSERT INTO public.focus_sessions (
    id, user_id, subject_id, chapter_id, planned_minutes, actual_minutes,
    completed, broken, xp_earned, xp_deducted, break_reason, started_at,
    ended_at, comeback_bonus
  ) VALUES (
    p_session_id, v_user_id, p_subject_id, p_chapter_id, p_planned_minutes,
    p_actual_minutes, p_completed, p_broken, v_xp, v_xp_deducted,
    CASE WHEN p_broken THEN 'user_abandoned' ELSE '' END,
    p_started_at, p_ended_at, p_comeback_bonus
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT fs.* INTO v_existing FROM public.focus_sessions fs WHERE fs.id = p_session_id LIMIT 1;
    IF v_existing.user_id <> v_user_id THEN
      RETURN json_build_object('accepted', false, 'conflict_code', 'session_not_owned', 'message', 'This session belongs to another account.');
    END IF;
    RETURN json_build_object('accepted', true, 'duplicate', true, 'focus_session_id', v_existing.id, 'verified_minutes', COALESCE(v_existing.actual_minutes, 0), 'xp_earned', COALESCE(v_existing.xp_earned, 0), 'xp_deducted', COALESCE(v_existing.xp_deducted, 0));
  END IF;

  IF p_broken THEN
    v_new_xp := GREATEST(0, v_new_xp - v_xp_deducted);
    v_new_streak := 0;
  ELSE
    IF p_is_recovery THEN
      v_new_streak := GREATEST(1, CEIL(COALESCE(p_recovery_lost_streak, 0) / 2.0)::integer);
    ELSIF v_last_study_date IS DISTINCT FROM v_today THEN
      IF v_last_study_date = v_yesterday OR v_last_study_date IS NULL THEN
        v_new_streak := v_new_streak + 1;
      ELSE
        v_new_streak := 1;
      END IF;
    END IF;
    v_new_xp := v_new_xp + v_xp;
  END IF;

  INSERT INTO public.xp_transactions (id, user_id, amount, reason, created_at)
  VALUES (
    p_session_id, v_user_id,
    CASE WHEN p_broken THEN -v_xp_deducted ELSE v_xp END,
    CASE WHEN p_broken THEN 'session_broken' ELSE 'session_complete' END,
    p_ended_at
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.daily_summary (
    user_id, date, total_focus_minutes, sessions_completed, sessions_broken,
    goal_minutes, goal_met, xp_earned
  ) VALUES (
    v_user_id, v_today, p_actual_minutes,
    CASE WHEN p_completed THEN 1 ELSE 0 END,
    CASE WHEN p_broken THEN 1 ELSE 0 END,
    v_daily_goal, v_goal_met, CASE WHEN p_broken THEN 0 ELSE v_xp END
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_focus_minutes = public.daily_summary.total_focus_minutes + EXCLUDED.total_focus_minutes,
    sessions_completed = public.daily_summary.sessions_completed + EXCLUDED.sessions_completed,
    sessions_broken = public.daily_summary.sessions_broken + EXCLUDED.sessions_broken,
    goal_minutes = EXCLUDED.goal_minutes,
    goal_met = public.daily_summary.total_focus_minutes + EXCLUDED.total_focus_minutes >= EXCLUDED.goal_minutes,
    xp_earned = public.daily_summary.xp_earned + EXCLUDED.xp_earned;

  UPDATE public.users
     SET xp = v_new_xp,
         streak = v_new_streak,
         longest_streak = GREATEST(COALESCE(longest_streak, 0), v_new_streak),
         last_study_date = CASE WHEN p_completed THEN v_today ELSE last_study_date END
   WHERE id = v_user_id;

  IF p_completed THEN
    BEGIN
      v_referral_result := private.process_referral_bonus(v_user_id);
      v_referral_xp := COALESCE((v_referral_result ->> 'referee_xp_added')::integer, 0);
      IF v_referral_xp > 0 THEN v_new_xp := v_new_xp + v_referral_xp; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_referral_result := json_build_object('success', false);
      v_referral_xp := 0;
    END;
  END IF;

  SELECT COALESCE(u.xp, 0) INTO v_new_xp FROM public.users u WHERE u.id = v_user_id LIMIT 1;

  IF p_study_group_id IS NOT NULL THEN
    INSERT INTO public.study_group_sessions (
      group_id, user_id, focus_session_id, started_at, ended_at,
      actual_minutes, completed, broken
    ) VALUES (
      p_study_group_id, v_user_id, p_session_id, p_started_at, p_ended_at,
      p_actual_minutes, p_completed, p_broken
    ) ON CONFLICT (focus_session_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'accepted', true,
    'duplicate', false,
    'focus_session_id', p_session_id,
    'verified_minutes', p_actual_minutes,
    'xp_earned', v_xp,
    'xp_deducted', v_xp_deducted,
    'referral_xp_awarded', v_referral_xp,
    'new_xp_total', v_new_xp,
    'new_streak', v_new_streak
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_offline_focus_session(
  p_session_id uuid,
  p_subject_id uuid,
  p_chapter_id uuid,
  p_study_group_id uuid,
  p_planned_minutes integer,
  p_actual_minutes integer,
  p_elapsed_seconds integer,
  p_completed boolean,
  p_broken boolean,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_clock_anomaly boolean DEFAULT false,
  p_is_recovery boolean DEFAULT false,
  p_recovery_lost_streak integer DEFAULT NULL,
  p_comeback_bonus integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('accepted', false, 'conflict_code', 'auth_required', 'message', 'Authentication required.');
  END IF;
  RETURN private.sync_offline_focus_session(
    p_session_id, p_subject_id, p_chapter_id, p_study_group_id,
    p_planned_minutes, p_actual_minutes, p_elapsed_seconds, p_completed,
    p_broken, p_started_at, p_ended_at, p_clock_anomaly, p_is_recovery,
    p_recovery_lost_streak, p_comeback_bonus
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) TO authenticated;

COMMIT;
