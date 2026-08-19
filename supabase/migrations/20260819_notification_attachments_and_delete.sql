BEGIN;

ALTER TABLE public.notification_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes integer,
  ADD COLUMN IF NOT EXISTS link_url text;

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes integer,
  ADD COLUMN IF NOT EXISTS link_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_messages_attachment_fields_check'
      AND conrelid = 'public.notification_messages'::regclass
  ) THEN
    ALTER TABLE public.notification_messages
      ADD CONSTRAINT notification_messages_attachment_fields_check
      CHECK (
        (attachment_path IS NULL AND attachment_mime_type IS NULL AND attachment_size_bytes IS NULL)
        OR (
          attachment_path IS NOT NULL
          AND attachment_mime_type IN ('image/jpeg', 'application/pdf')
          AND attachment_size_bytes BETWEEN 1 AND 5242880
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_messages_link_url_check'
      AND conrelid = 'public.notification_messages'::regclass
  ) THEN
    ALTER TABLE public.notification_messages
      ADD CONSTRAINT notification_messages_link_url_check
      CHECK (link_url IS NULL OR (char_length(btrim(link_url)) BETWEEN 1 AND 2048 AND btrim(link_url) ~ '^https?://'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_notifications_attachment_fields_check'
      AND conrelid = 'public.user_notifications'::regclass
  ) THEN
    ALTER TABLE public.user_notifications
      ADD CONSTRAINT user_notifications_attachment_fields_check
      CHECK (
        (attachment_path IS NULL AND attachment_mime_type IS NULL AND attachment_size_bytes IS NULL)
        OR (
          attachment_path IS NOT NULL
          AND attachment_mime_type IN ('image/jpeg', 'application/pdf')
          AND attachment_size_bytes BETWEEN 1 AND 5242880
        )
      );
  END IF;
END;
$$;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, DELETE ON public.user_notifications TO authenticated;
DROP POLICY IF EXISTS user_notifications_owner_delete ON public.user_notifications;
CREATE POLICY user_notifications_owner_delete
  ON public.user_notifications
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notification-attachments',
  'notification-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'application/pdf']::text[];

DROP POLICY IF EXISTS "Notification admins can upload attachments" ON storage.objects;
CREATE POLICY "Notification admins can upload attachments"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notification-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.is_notification_admin())
    AND (SELECT private.is_email_confirmed())
  );

DROP POLICY IF EXISTS "Notification recipients can read attachments" ON storage.objects;
CREATE POLICY "Notification recipients can read attachments"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'notification-attachments'
    AND (
      (
        (SELECT private.is_notification_admin())
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_notifications un
        JOIN public.notification_messages nm ON nm.id = un.message_id
        WHERE un.user_id = (SELECT auth.uid())
          AND nm.attachment_path = name
      )
    )
  );

DROP POLICY IF EXISTS "Notification admins can update attachments" ON storage.objects;
CREATE POLICY "Notification admins can update attachments"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'notification-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.is_notification_admin())
    AND (SELECT private.is_email_confirmed())
  )
  WITH CHECK (
    bucket_id = 'notification-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.is_notification_admin())
    AND (SELECT private.is_email_confirmed())
  );

DROP POLICY IF EXISTS "Notification admins can delete attachments" ON storage.objects;
CREATE POLICY "Notification admins can delete attachments"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'notification-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.is_notification_admin())
    AND (SELECT private.is_email_confirmed())
    AND EXISTS (
      SELECT 1
      FROM public.notification_messages nm
      WHERE nm.sender_id = (SELECT auth.uid())
        AND nm.attachment_path = name
    )
  );

COMMIT;
