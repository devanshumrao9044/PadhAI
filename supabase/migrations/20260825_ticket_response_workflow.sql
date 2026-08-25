-- Ticket response workflow: only the PadhAI owner may reply or resolve a ticket.
-- The RPC updates the ticket and creates the user's in-app notification atomically.
-- Client code must not update study_group_tickets directly.

CREATE OR REPLACE FUNCTION private.respond_to_study_group_ticket(
  p_ticket_id uuid,
  p_status text,
  p_resolution text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_subject text;
  v_resolution text := btrim(COALESCE(p_resolution, ''));
  v_title text := 'PadhAI ticket update';
  v_body text;
  v_message_id uuid;
BEGIN
  IF NOT (SELECT private.is_padhai_owner()) THEN
    RAISE EXCEPTION 'PadhAI owner access required';
  END IF;
  IF p_status NOT IN ('in_progress', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid ticket status';
  END IF;
  IF char_length(v_resolution) < 3 OR char_length(v_resolution) > 1000 THEN
    RAISE EXCEPTION 'Ticket response must be between 3 and 1000 characters';
  END IF;

  SELECT t.user_id, t.subject
    INTO v_user_id, v_subject
    FROM public.study_group_tickets AS t
   WHERE t.id = p_ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.study_group_tickets
     SET status = p_status,
         resolution = v_resolution,
         updated_at = now(),
         resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN now() ELSE NULL END
   WHERE id = p_ticket_id;

  v_body := left(
    format(
      'Ticket "%s" update: %s%s',
      left(COALESCE(v_subject, 'Support request'), 90),
      left(v_resolution, 380),
      CASE WHEN p_status IN ('resolved', 'closed') THEN ' Issue marked as solved by PadhAI.' ELSE '' END
    ),
    500
  );

  INSERT INTO public.notification_messages (
    sender_id,
    target_type,
    target_user_id,
    title,
    body
  )
  VALUES (
    (SELECT auth.uid()),
    'user',
    v_user_id,
    v_title,
    v_body
  )
  RETURNING id INTO v_message_id;

  INSERT INTO public.user_notifications (
    message_id,
    user_id,
    title,
    body
  )
  VALUES (
    v_message_id,
    v_user_id,
    v_title,
    v_body
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.respond_to_study_group_ticket(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.respond_to_study_group_ticket(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION private.close_study_group_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  RETURN private.respond_to_study_group_ticket(
    p_ticket_id,
    'closed',
    'Issue marked as solved by PadhAI. If the problem continues, please submit a new ticket with the latest details.'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.close_study_group_ticket(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.close_study_group_ticket(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_study_group_ticket(
  p_ticket_id uuid,
  p_status text,
  p_resolution text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.respond_to_study_group_ticket(p_ticket_id, p_status, p_resolution);
$function$;

REVOKE ALL ON FUNCTION public.respond_to_study_group_ticket(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_study_group_ticket(uuid, text, text) TO authenticated;

-- Keep the existing RPC name functional for older clients, but route it through
-- the same response path so closing a ticket also notifies its owner.
CREATE OR REPLACE FUNCTION public.close_study_group_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.close_study_group_ticket(p_ticket_id);
$function$;

REVOKE ALL ON FUNCTION public.close_study_group_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_study_group_ticket(uuid) TO authenticated;
