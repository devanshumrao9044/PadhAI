-- Fix the Study Groups join RPC's ambiguous `status` references.
-- The function returns a TABLE column named `status`, so unqualified status
-- references inside PL/pgSQL can conflict with the output variable namespace.
-- This replacement preserves the existing authentication, active-group lock,
-- invite validation, capacity check, and pending/approved behavior.

CREATE OR REPLACE FUNCTION private.join_study_group(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL
)
RETURNS TABLE(
  membership_id uuid,
  group_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $function$
DECLARE
  v_group public.study_groups%ROWTYPE;
  v_status text;
  v_membership public.study_group_members%ROWTYPE;
  v_existing boolean := false;
  v_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT g.*
  INTO v_group
  FROM public.study_groups AS g
  WHERE g.id = p_group_id
    AND g.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study group not found';
  END IF;

  IF v_group.visibility = 'private'
     AND NOT (SELECT private.valid_study_group_invite(p_group_id, p_invite_token)) THEN
    RAISE EXCEPTION 'A valid invite link is required for this private group';
  END IF;

  SELECT m.*
  INTO v_membership
  FROM public.study_group_members AS m
  WHERE m.group_id = p_group_id
    AND m.user_id = (SELECT auth.uid());
  v_existing := FOUND;

  IF v_existing AND v_membership.status = 'approved' THEN
    RETURN QUERY SELECT v_membership.id, v_membership.group_id, v_membership.status;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_count
  FROM public.study_group_members AS m
  WHERE m.group_id = p_group_id
    AND m.status IN ('pending', 'approved');

  IF v_count >= v_group.max_members THEN
    RAISE EXCEPTION 'This study group is full';
  END IF;

  v_status := CASE
    WHEN v_group.visibility = 'public' THEN 'approved'
    ELSE 'pending'
  END;

  IF v_existing THEN
    UPDATE public.study_group_members AS m
    SET status = v_status,
        joined_at = now(),
        approved_at = CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
    WHERE m.id = v_membership.id
    RETURNING m.* INTO v_membership;
  ELSE
    INSERT INTO public.study_group_members (
      group_id,
      user_id,
      status,
      icon_key,
      approved_at
    )
    VALUES (
      p_group_id,
      (SELECT auth.uid()),
      v_status,
      'books',
      CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
    )
    RETURNING * INTO v_membership;
  END IF;

  RETURN QUERY SELECT v_membership.id, v_membership.group_id, v_membership.status;
END;
$function$;
