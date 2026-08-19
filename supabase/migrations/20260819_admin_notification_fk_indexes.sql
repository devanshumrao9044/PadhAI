BEGIN;

CREATE INDEX IF NOT EXISTS notification_admins_granted_by_idx
  ON public.notification_admins (granted_by);

CREATE INDEX IF NOT EXISTS notification_messages_target_user_idx
  ON public.notification_messages (target_user_id);

COMMIT;
