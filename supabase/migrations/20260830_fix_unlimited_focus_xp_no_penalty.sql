BEGIN;

CREATE OR REPLACE FUNCTION private.sync_offline_focus_session(
  p_session_id uuid, p_subject_id uuid, p_chapter_id uuid, p_study_group_id uuid,
  p_planned_minutes integer, p_actual_minutes integer, p_elapsed_seconds integer,
  p_completed boolean, p_broken boolean, p_started_at timestamptz, p_ended_at timestamptz,
  p_clock_anomaly boolean DEFAULT false, p_is_recovery boolean DEFAULT false,
  p_recovery_lost_streak integer DEFAULT NULL, p_comeback_bonus integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_result json;
  v_penalty integer := 0;
  v_user_id uuid := auth.uid();
  v_new_xp integer := 0;
  v_before_xp integer := 0;
BEGIN
  -- Unlimited Focus is represented by the reserved 1440-minute duration.
  -- Capture the exact XP balance before legacy settlement so a broken unlimited
  -- session can be made consequence-free without ever over-crediting low-XP users.
  IF p_planned_minutes = 1440 AND p_broken AND v_user_id IS NOT NULL THEN
    SELECT COALESCE(xp, 0) INTO v_before_xp
    FROM public.users
    WHERE id = v_user_id
    FOR UPDATE;
  END IF;

  v_result := private.sync_offline_focus_session_legacy(
    p_session_id, p_subject_id, p_chapter_id, p_study_group_id,
    p_planned_minutes, p_actual_minutes, p_elapsed_seconds,
    p_completed, p_broken, p_started_at, p_ended_at,
    p_clock_anomaly, p_is_recovery, p_recovery_lost_streak, p_comeback_bonus
  );

  IF p_planned_minutes = 1440
     AND p_broken
     AND COALESCE((v_result->>'accepted')::boolean, false)
     AND COALESCE((v_result->>'duplicate')::boolean, false) = false
     AND v_user_id IS NOT NULL THEN
    v_penalty := COALESCE((v_result->>'xp_deducted')::integer, 0);

    -- Restore the exact pre-settlement balance, rather than adding the penalty
    -- back to the post-settlement balance (which could over-credit a user whose
    -- XP was below the legacy 50 XP cap).
    UPDATE public.users
    SET xp = v_before_xp
    WHERE id = v_user_id;

    UPDATE public.focus_sessions
    SET xp_deducted = 0
    WHERE id = p_session_id
      AND user_id = v_user_id;

    UPDATE public.xp_transactions
    SET amount = 0,
        reason = 'session_broken_unlimited'
    WHERE id = p_session_id
      AND user_id = v_user_id;

    SELECT COALESCE(xp, 0) INTO v_new_xp
    FROM public.users
    WHERE id = v_user_id;

    v_result := (v_result::jsonb || jsonb_build_object(
      'xp_deducted', 0,
      'new_xp_total', v_new_xp
    ))::json;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_offline_focus_session(uuid, uuid, uuid, uuid, integer, integer, integer, boolean, boolean, timestamptz, timestamptz, boolean, boolean, integer, integer) TO authenticated;

COMMIT;
