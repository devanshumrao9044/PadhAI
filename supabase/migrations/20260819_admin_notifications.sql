-- Secure Owner/Admin notification infrastructure.
-- The sender Edge Function is the only client-facing write path for broadcasts.
-- User notifications and device tokens remain owner-scoped under RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.notification_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_admins FROM PUBLIC, anon;
GRANT SELECT ON public.notification_admins TO authenticated;
DROP POLICY IF EXISTS notification_admins_self_select ON public.notification_admins;
CREATE POLICY notification_admins_self_select
  ON public.notification_admins
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION private.is_notification_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_admins
    WHERE user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.is_notification_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_notification_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('user', 'all', 'level')),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_level integer,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'user' AND target_user_id IS NOT NULL AND target_level IS NULL)
    OR (target_type = 'all' AND target_user_id IS NULL AND target_level IS NULL)
    OR (target_type = 'level' AND target_user_id IS NULL AND target_level BETWEEN 1 AND 10)
  )
);

CREATE INDEX IF NOT EXISTS notification_messages_sender_created_idx
  ON public.notification_messages (sender_id, created_at DESC);

ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_messages FROM PUBLIC, anon;
GRANT SELECT ON public.notification_messages TO authenticated;
DROP POLICY IF EXISTS notification_messages_admin_select ON public.notification_messages;
CREATE POLICY notification_messages_admin_select
  ON public.notification_messages
  FOR SELECT TO authenticated
  USING ((SELECT private.is_notification_admin()) AND sender_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.notification_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_notifications FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
DROP POLICY IF EXISTS user_notifications_owner_select ON public.user_notifications;
CREATE POLICY user_notifications_owner_select
  ON public.user_notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_notifications_owner_update ON public.user_notifications;
CREATE POLICY user_notifications_owner_update
  ON public.user_notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_devices_user_enabled_idx
  ON public.notification_devices (user_id, enabled);

ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_devices FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_devices TO authenticated;
DROP POLICY IF EXISTS notification_devices_owner_all ON public.notification_devices;
CREATE POLICY notification_devices_owner_all
  ON public.notification_devices
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- The existing verified owner account receives the owner role. No email is stored
-- in application code; authorization is resolved by auth user UUID server-side.
INSERT INTO public.notification_admins (user_id, role)
VALUES ('15fbaba8-a37f-495e-805b-23ef72c7f6ab', 'owner')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';

COMMIT;
