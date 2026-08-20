-- Study Groups moderation correction: app-owner inbox only.
-- Group owners/admins may manage membership and group settings, but cannot
-- inspect or resolve complaints/tickets submitted to the PadhAI owner.

CREATE OR REPLACE FUNCTION public.review_study_group_report(
  p_report_id uuid,
  p_status text,
  p_resolution text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF p_status NOT IN ('pending', 'reviewed', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid report status';
  END IF;
  IF NOT (SELECT private.is_padhai_owner()) THEN
    RAISE EXCEPTION 'PadhAI owner access required';
  END IF;
  UPDATE public.study_group_reports
  SET status = p_status,
      resolution = COALESCE(p_resolution, ''),
      reviewed_by = (SELECT auth.uid()),
      reviewed_at = now()
  WHERE id = p_report_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_study_group_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF NOT (SELECT private.is_padhai_owner()) THEN
    RAISE EXCEPTION 'PadhAI owner access required';
  END IF;
  UPDATE public.study_group_tickets
  SET status = 'closed', updated_at = now()
  WHERE id = p_ticket_id;
  RETURN FOUND;
END;
$$;

DROP POLICY IF EXISTS study_group_reports_scoped_select ON public.study_group_reports;
CREATE POLICY study_group_reports_scoped_select
  ON public.study_group_reports FOR SELECT TO authenticated
  USING ((SELECT private.is_padhai_owner()));

DROP POLICY IF EXISTS study_group_tickets_scoped_select ON public.study_group_tickets;
CREATE POLICY study_group_tickets_scoped_select
  ON public.study_group_tickets FOR SELECT TO authenticated
  USING ((SELECT private.is_padhai_owner()));

REVOKE ALL ON FUNCTION public.review_study_group_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_study_group_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_study_group_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_study_group_ticket(uuid) TO authenticated;
