-- Offline Focus synchronization with server-side validation and idempotent rewards.
-- Client session IDs reuse focus_sessions.id, so retries cannot create duplicates.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

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
  v_daily_goal integer;
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_yesterday date := v_today - 1;
  v_xp integer := 0;
  v_xp_deducted integer := 0;
  v_referral_result json := '{}'::json;
  v_referral_xp integer := 0;
  v_new_xp integer := 0;
  v_new_streak integer := 0;
  v_existing_total integer := 0;
  v_goal_met boolean := false;
  v_last_study_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'auth_required',
      'message', 'Authentication required.'
    );
  END IF;

  IF p_session_id IS NULL THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'session_id_required',
      'message', 'Session ID is required.'
    );
  END IF;

  SELECT fs.*
    INTO v_existing
    FROM public.focus_sessions fs
   WHERE fs.id = p_session_id
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.user_id <> v_user_id THEN
      RETURN json_build_object(
        'accepted', false,
        'conflict_code', 'session_not_owned',
        'message', 'This session belongs to another account.'
      );
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
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'clock_changed',
      'message', 'Device clock changed during the session.'
    );
  END IF;

  IF p_completed IS DISTINCT FROM (NOT p_broken) THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'invalid_completion_state',
      'message', 'The session completion state is invalid.'
    );
  END IF;

  IF p_planned_minutes IS NULL OR p_planned_minutes NOT BETWEEN 1 AND 1440
     OR p_actual_minutes IS NULL OR p_actual_minutes NOT BETWEEN 0 AND 1440
     OR p_elapsed_seconds IS NULL OR p_elapsed_seconds NOT BETWEEN 0 AND 86400 THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'duration_invalid',
      'message', 'The session duration is outside the allowed range.'
    );
  END IF;

  IF p_actual_minutes <> FLOOR(p_elapsed_seconds / 60.0)::integer THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'duration_mismatch',
      'message', 'The elapsed duration does not match the session duration.'
    );
  END IF;

  IF p_started_at IS NULL OR p_ended_at IS NULL OR p_ended_at < p_started_at THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'timestamps_invalid',
      'message', 'The session timestamps are invalid.'
    );
  END IF;

  IF p_comeback_bonus NOT IN (0, 50) THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'bonus_invalid',
      'message', 'The comeback bonus is invalid.'
    );
  END IF;

  IF p_is_recovery AND p_actual_minutes < 30 THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'recovery_duration_invalid',
      'message', 'A recovery session requires at least 30 minutes.'
    );
  END IF;

  IF p_is_recovery AND COALESCE(p_recovery_lost_streak, 0) < 1 THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'recovery_state_invalid',
      'message', 'The recovery state is invalid.'
    );
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.subjects s
     WHERE s.id = p_subject_id
       AND s.user_id = v_user_id
       AND COALESCE(s.is_deleted, false) = false
  ) THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'subject_not_owned',
      'message', 'The selected subject is no longer available.'
    );
  END IF;

  IF p_chapter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.chapters c
     WHERE c.id = p_chapter_id
       AND c.user_id = v_user_id
       AND COALESCE(c.is_deleted, false) = false
  ) THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'chapter_not_owned_or_deleted',
      'message', 'The selected chapter is no longer available.'
    );
  END IF;

  IF p_study_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.study_group_members gm
     WHERE gm.group_id = p_study_group_id
       AND gm.user_id = v_user_id
       AND gm.status = 'approved'
  ) THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'group_membership_invalid',
      'message', 'The study-group membership is no longer active.'
    );
  END IF;

  SELECT COALESCE(u.daily_goal_minutes, 120), COALESCE(u.xp, 0), COALESCE(u.streak, 0)
    INTO v_daily_goal, v_new_xp, v_new_streak
    FROM public.users u
   WHERE u.id = v_user_id
   LIMIT 1;

  IF v_daily_goal IS NULL THEN
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'profile_not_found',
      'message', 'The user profile could not be found.'
    );
  END IF;

  IF p_broken THEN
    v_xp_deducted := FLOOR(p_planned_minutes * 1.0)::integer;
  ELSE
    v_xp := FLOOR(p_actual_minutes * 2.0)::integer + p_comeback_bonus;
  END IF;

  INSERT INTO public.focus_sessions (
    id,
    user_id,
    subject_id,
    chapter_id,
    planned_minutes,
    actual_minutes,
    completed,
    broken,
    xp_earned,
    xp_deducted,
    break_reason,
    started_at,
    ended_at,
    comeback_bonus
  ) VALUES (
    p_session_id,
    v_user_id,
    p_subject_id,
    p_chapter_id,
    p_planned_minutes,
    p_actual_minutes,
    p_completed,
    p_broken,
    v_xp,
    v_xp_deducted,
    CASE WHEN p_broken THEN 'user_abandoned' ELSE '' END,
    p_started_at,
    p_ended_at,
    p_comeback_bonus
  );

  IF p_broken THEN
    v_new_xp := GREATEST(0, v_new_xp - v_xp_deducted);
    v_new_streak := 0;
  ELSE
    IF p_is_recovery THEN
      v_new_streak := GREATEST(1, CEIL(COALESCE(p_recovery_lost_streak, 0) / 2.0)::integer);
    ELSE
      SELECT COALESCE(u.streak, 0), u.last_study_date
        INTO v_new_streak, v_last_study_date
        FROM public.users u
       WHERE u.id = v_user_id
       LIMIT 1;

      IF v_last_study_date IS DISTINCT FROM v_today THEN
        -- The date comparison is performed using the UTC settlement date.
        IF v_last_study_date = v_yesterday OR v_last_study_date IS NULL THEN
          v_new_streak := v_new_streak + 1;
        ELSE
          v_new_streak := 1;
        END IF;
      END IF;
    END IF;
    v_new_xp := v_new_xp + v_xp;
  END IF;

  INSERT INTO public.xp_transactions (id, user_id, amount, reason, created_at)
  VALUES (
    p_session_id,
    v_user_id,
    CASE WHEN p_broken THEN -v_xp_deducted ELSE v_xp END,
    CASE WHEN p_broken THEN 'session_broken' ELSE 'session_complete' END,
    p_ended_at
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(ds.total_focus_minutes, 0)
    INTO v_existing_total
    FROM public.daily_summary ds
   WHERE ds.user_id = v_user_id
     AND ds.date = v_today
   LIMIT 1;

  v_existing_total := v_existing_total + p_actual_minutes;
  v_goal_met := v_existing_total >= v_daily_goal;

  INSERT INTO public.daily_summary (
    user_id,
    date,
    total_focus_minutes,
    sessions_completed,
    sessions_broken,
    goal_minutes,
    goal_met,
    xp_earned
  ) VALUES (
    v_user_id,
    v_today,
    p_actual_minutes,
    CASE WHEN p_completed THEN 1 ELSE 0 END,
    CASE WHEN p_broken THEN 1 ELSE 0 END,
    v_daily_goal,
    v_goal_met,
    CASE WHEN p_broken THEN 0 ELSE v_xp END
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
      IF v_referral_xp > 0 THEN
        v_new_xp := v_new_xp + v_referral_xp;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_referral_result := json_build_object('success', false);
      v_referral_xp := 0;
    END;
  END IF;

  SELECT COALESCE(u.xp, 0) INTO v_new_xp
    FROM public.users u
   WHERE u.id = v_user_id
   LIMIT 1;

  IF p_study_group_id IS NOT NULL THEN
    INSERT INTO public.study_group_sessions (
      group_id,
      user_id,
      focus_session_id,
      started_at,
      ended_at,
      actual_minutes,
      completed,
      broken
    ) VALUES (
      p_study_group_id,
      v_user_id,
      p_session_id,
      p_started_at,
      p_ended_at,
      p_actual_minutes,
      p_completed,
      p_broken
    )
    ON CONFLICT (focus_session_id) DO NOTHING;
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
    RETURN json_build_object(
      'accepted', false,
      'conflict_code', 'auth_required',
      'message', 'Authentication required.'
    );
  END IF;
  RETURN private.sync_offline_focus_session(
    p_session_id,
    p_subject_id,
    p_chapter_id,
    p_study_group_id,
    p_planned_minutes,
    p_actual_minutes,
    p_elapsed_seconds,
    p_completed,
    p_broken,
    p_started_at,
    p_ended_at,
    p_clock_anomaly,
    p_is_recovery,
    p_recovery_lost_streak,
    p_comeback_bonus
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) TO authenticated;

COMMIT;
