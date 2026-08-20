-- Reduce Supabase security-advisor exposure for Study Groups RPCs.
--
-- The original implementations require SECURITY DEFINER because they perform
-- controlled multi-table work behind RLS. Move those implementations into the
-- non-API private schema and retain same-signature SECURITY INVOKER wrappers in
-- public. The private implementations keep their internal auth/member/owner
-- checks; the public wrappers preserve the existing RPC names used by the app.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.archive_study_group(uuid) SET SCHEMA private;
ALTER FUNCTION public.close_study_group_ticket(uuid) SET SCHEMA private;
ALTER FUNCTION public.create_study_group(text, text, text, text, integer, integer, text, text) SET SCHEMA private;
ALTER FUNCTION public.create_study_group_invite(uuid) SET SCHEMA private;
ALTER FUNCTION public.get_pending_study_group_members(uuid) SET SCHEMA private;
ALTER FUNCTION public.get_public_study_groups(text, integer) SET SCHEMA private;
ALTER FUNCTION public.get_study_group_by_invite(text) SET SCHEMA private;
ALTER FUNCTION public.get_study_group_members(uuid) SET SCHEMA private;
ALTER FUNCTION public.join_study_group(uuid, text) SET SCHEMA private;
ALTER FUNCTION public.leave_study_group(uuid) SET SCHEMA private;
ALTER FUNCTION public.review_study_group_member(uuid, text) SET SCHEMA private;
ALTER FUNCTION public.review_study_group_report(uuid, text, text) SET SCHEMA private;
ALTER FUNCTION public.update_study_group_icon(uuid, text) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.archive_study_group(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.close_study_group_ticket(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_study_group(text, text, text, text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_study_group_invite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_pending_study_group_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_public_study_groups(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_study_group_by_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_study_group_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.join_study_group(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.leave_study_group(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_study_group_member(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_study_group_report(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.update_study_group_icon(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.archive_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.close_study_group_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_study_group(text, text, text, text, integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_study_group_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_pending_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_public_study_groups(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_study_group_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.join_study_group(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.leave_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.review_study_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.review_study_group_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.update_study_group_icon(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.archive_study_group(p_group_id);
$function$;

CREATE OR REPLACE FUNCTION public.close_study_group_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.close_study_group_ticket(p_ticket_id);
$function$;

CREATE OR REPLACE FUNCTION public.create_study_group(
  p_name text,
  p_description text DEFAULT '',
  p_rules text DEFAULT '',
  p_target_exam text DEFAULT 'OTHER',
  p_daily_goal_minutes integer DEFAULT 120,
  p_max_members integer DEFAULT 12,
  p_visibility text DEFAULT 'private',
  p_icon_key text DEFAULT 'books'
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  rules text,
  target_exam text,
  daily_goal_minutes integer,
  max_members integer,
  visibility text,
  icon_key text,
  join_code text,
  invite_token text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT *
  FROM private.create_study_group(
    p_name,
    p_description,
    p_rules,
    p_target_exam,
    p_daily_goal_minutes,
    p_max_members,
    p_visibility,
    p_icon_key
  );
$function$;

CREATE OR REPLACE FUNCTION public.create_study_group_invite(p_group_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.create_study_group_invite(p_group_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  icon_key text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.get_pending_study_group_members(p_group_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_public_study_groups(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  target_exam text,
  daily_goal_minutes integer,
  max_members integer,
  visibility text,
  icon_key text,
  join_code text,
  member_count bigint,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.get_public_study_groups(p_query, p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.get_study_group_by_invite(p_token text)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  rules text,
  target_exam text,
  daily_goal_minutes integer,
  max_members integer,
  visibility text,
  icon_key text,
  member_count bigint,
  invite_valid boolean
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.get_study_group_by_invite(p_token);
$function$;

CREATE OR REPLACE FUNCTION public.get_study_group_members(p_group_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  icon_key text,
  presence_status text,
  presence_started_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  today_minutes bigint
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.get_study_group_members(p_group_id);
$function$;

CREATE OR REPLACE FUNCTION public.join_study_group(
  p_group_id uuid,
  p_invite_token text DEFAULT NULL
)
RETURNS TABLE(
  membership_id uuid,
  group_id uuid,
  status text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.join_study_group(p_group_id, p_invite_token);
$function$;

CREATE OR REPLACE FUNCTION public.leave_study_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.leave_study_group(p_group_id);
$function$;

CREATE OR REPLACE FUNCTION public.review_study_group_member(
  p_membership_id uuid,
  p_status text
)
RETURNS TABLE(
  membership_id uuid,
  group_id uuid,
  status text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT * FROM private.review_study_group_member(p_membership_id, p_status);
$function$;

CREATE OR REPLACE FUNCTION public.review_study_group_report(
  p_report_id uuid,
  p_status text,
  p_resolution text DEFAULT ''
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.review_study_group_report(p_report_id, p_status, p_resolution);
$function$;

CREATE OR REPLACE FUNCTION public.update_study_group_icon(
  p_group_id uuid,
  p_icon_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, private
AS $function$
  SELECT private.update_study_group_icon(p_group_id, p_icon_key);
$function$;

REVOKE ALL ON FUNCTION public.archive_study_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_study_group_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_study_group(text, text, text, text, integer, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_study_group_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pending_study_group_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_study_groups(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_study_group_by_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_study_group_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_study_group(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_study_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_study_group_member(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_study_group_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_study_group_icon(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.archive_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_study_group_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_study_group(text, text, text, text, integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_study_group_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_study_groups(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_study_group_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_study_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_study_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_study_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_study_group_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_study_group_icon(uuid, text) TO authenticated;

COMMENT ON SCHEMA private IS
  'Contains privileged Study Groups implementations; public RPCs are SECURITY INVOKER wrappers with server-side role checks.';
