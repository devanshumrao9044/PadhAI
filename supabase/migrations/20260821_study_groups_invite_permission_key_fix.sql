-- Correct the invite RLS permission key to match the stored permissions JSON.
-- The server-side permission contract uses snake_case keys.

DROP POLICY IF EXISTS study_group_invites_admin_select ON public.study_group_invites;

CREATE POLICY study_group_invites_admin_select
ON public.study_group_invites
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_padhai_owner())
  OR (SELECT private.has_study_group_permission(study_group_invites.group_id, 'manage_invites'))
);
