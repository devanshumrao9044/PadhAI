-- Performance and policy consolidation for Study Groups.
--
-- These indexes support foreign-key lookups and owner/moderation joins used by
-- RLS and application queries. The presence policy split preserves the exact
-- authorization semantics while leaving only one permissive SELECT policy.

CREATE INDEX IF NOT EXISTS study_group_invites_created_by_idx
  ON public.study_group_invites (created_by);

CREATE INDEX IF NOT EXISTS study_group_presence_user_id_idx
  ON public.study_group_presence (user_id);

CREATE INDEX IF NOT EXISTS study_group_reports_reported_user_id_idx
  ON public.study_group_reports (reported_user_id);

CREATE INDEX IF NOT EXISTS study_group_reports_reviewed_by_idx
  ON public.study_group_reports (reviewed_by);

CREATE INDEX IF NOT EXISTS study_group_tickets_group_id_idx
  ON public.study_group_tickets (group_id);

CREATE INDEX IF NOT EXISTS study_group_tickets_report_id_idx
  ON public.study_group_tickets (report_id);

-- The old ALL policy also covered SELECT, which overlapped with the broader
-- scoped SELECT policy. Keep the broad SELECT policy and make write access
-- explicit so members can only insert/update/delete their own presence row.
DROP POLICY IF EXISTS study_group_presence_owner_write
  ON public.study_group_presence;

CREATE POLICY study_group_presence_owner_insert
  ON public.study_group_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT private.is_study_group_member(study_group_presence.group_id))
  );

CREATE POLICY study_group_presence_owner_update
  ON public.study_group_presence
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT private.is_study_group_member(study_group_presence.group_id))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT private.is_study_group_member(study_group_presence.group_id))
  );

CREATE POLICY study_group_presence_owner_delete
  ON public.study_group_presence
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT private.is_study_group_member(study_group_presence.group_id))
  );

COMMENT ON POLICY study_group_presence_scoped_select
  ON public.study_group_presence IS
  'Single scoped SELECT policy for owners, group admins, members, and the PadhAI owner; write policies remain owner-scoped.';
COMMENT ON POLICY study_group_presence_owner_insert
  ON public.study_group_presence IS
  'Authenticated members may insert only their own presence row.';
COMMENT ON POLICY study_group_presence_owner_update
  ON public.study_group_presence IS
  'Authenticated members may update only their own presence row.';
COMMENT ON POLICY study_group_presence_owner_delete
  ON public.study_group_presence IS
  'Authenticated members may delete only their own presence row.';

-- The deployed send-admin-notification function intentionally performs manual
-- JWT verification because it is invoked by both native and web clients.
-- Its verify_jwt=false setting is an explicit compatibility choice, not an
-- authorization bypass: the function validates the bearer token with
-- auth.getUser(accessToken) and checks notification_admins server-side.
