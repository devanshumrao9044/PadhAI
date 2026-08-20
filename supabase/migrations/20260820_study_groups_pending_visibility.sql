-- Pending members may see their own private-group preview and approval state, but not member activity.
BEGIN;

DROP POLICY IF EXISTS study_groups_member_select ON public.study_groups;
CREATE POLICY study_groups_member_select
  ON public.study_groups FOR SELECT TO authenticated
  USING (
    (SELECT private.is_padhai_owner())
    OR (status = 'active' AND visibility = 'public')
    OR (SELECT private.is_study_group_member(id))
    OR (SELECT private.is_study_group_admin(id))
    OR EXISTS (
      SELECT 1
      FROM public.study_group_members AS own_membership
      WHERE own_membership.group_id = study_groups.id
        AND own_membership.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
