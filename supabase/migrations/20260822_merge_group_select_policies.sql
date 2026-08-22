-- Merge duplicate permissive SELECT policies without changing visibility.

BEGIN;

DROP POLICY IF EXISTS study_group_reports_reporter_select ON public.study_group_reports;
DROP POLICY IF EXISTS study_group_reports_scoped_select ON public.study_group_reports;
CREATE POLICY study_group_reports_select
  ON public.study_group_reports
  FOR SELECT TO authenticated
  USING ((SELECT private.is_padhai_owner()) OR (SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS study_group_tickets_reporter_select ON public.study_group_tickets;
DROP POLICY IF EXISTS study_group_tickets_scoped_select ON public.study_group_tickets;
CREATE POLICY study_group_tickets_select
  ON public.study_group_tickets
  FOR SELECT TO authenticated
  USING ((SELECT private.is_padhai_owner()) OR (SELECT auth.uid()) = user_id);

COMMIT;
