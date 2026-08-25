-- Preserve the original membership rejoin semantics after the lifecycle patch:
-- approved members are idempotent, while pending/rejected rows can transition
-- according to the group's public/private policy. Every status reference is
-- qualified so it cannot collide with the RETURNS TABLE output column.

CREATE OR REPLACE FUNCTION private.join_study_group(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL
)
RETURNS TABLE (membership_id uuid, group_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  g public.study_groups%ROWTYPE;
  m public.study_group_members%ROWTYPE;
  v_existing boolean := false;
  v_count integer;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT gs.* INTO g
    FROM public.study_groups AS gs
   WHERE gs.id = p_group_id
     AND (gs.status = 'active' OR (gs.status = 'suspended' AND gs.suspended_until <= statement_timestamp()))
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study Group not found or currently suspended.';
  END IF;

  IF g.visibility = 'private' AND NOT EXISTS (
    SELECT 1
      FROM public.study_group_invites AS gi
     WHERE gi.group_id = g.id
       AND gi.token = NULLIF(trim(p_invite_token), '')
       AND gi.revoked_at IS NULL
       AND (gi.expires_at IS NULL OR gi.expires_at > statement_timestamp())
  ) THEN
    RAISE EXCEPTION 'A valid invite link is required for this private group.';
  END IF;

  SELECT gm.* INTO m
    FROM public.study_group_members AS gm
   WHERE gm.group_id = g.id
     AND gm.user_id = v_user_id;
  v_existing := FOUND;

  IF v_existing AND m.status = 'approved' THEN
    RETURN QUERY SELECT m.id, m.group_id, m.status;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_count
    FROM public.study_group_members AS gm
   WHERE gm.group_id = g.id
     AND gm.status IN ('pending', 'approved');
  IF v_count >= g.max_members THEN
    RAISE EXCEPTION 'This Study Group is full.';
  END IF;

  v_status := CASE
    WHEN g.owner_id = v_user_id OR g.visibility = 'public' THEN 'approved'
    ELSE 'pending'
  END;

  IF v_existing THEN
    UPDATE public.study_group_members AS gm
       SET status = v_status,
           joined_at = statement_timestamp(),
           approved_at = CASE WHEN v_status = 'approved' THEN statement_timestamp() ELSE NULL END
     WHERE gm.id = m.id
     RETURNING gm.* INTO m;
  ELSE
    INSERT INTO public.study_group_members (group_id, user_id, status, icon_key, approved_at)
    VALUES (
      g.id,
      v_user_id,
      v_status,
      'books',
      CASE WHEN v_status = 'approved' THEN statement_timestamp() ELSE NULL END
    )
    RETURNING * INTO m;
  END IF;

  RETURN QUERY SELECT m.id, m.group_id, m.status;
END;
$function$;

REVOKE ALL ON FUNCTION private.join_study_group(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.join_study_group(uuid, text) TO authenticated;
