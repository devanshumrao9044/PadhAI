-- Keep notification attachments bounded by type so Storage cannot grow unexpectedly.
-- Images are compressed client-side to <= 512 KiB; PDFs are limited to 3 MiB.

ALTER TABLE public.notification_messages
  DROP CONSTRAINT IF EXISTS notification_messages_attachment_fields_check;

ALTER TABLE public.notification_messages
  ADD CONSTRAINT notification_messages_attachment_fields_check
  CHECK (
    (attachment_path IS NULL AND attachment_mime_type IS NULL AND attachment_size_bytes IS NULL)
    OR (
      attachment_path IS NOT NULL
      AND attachment_mime_type IN ('image/jpeg', 'application/pdf')
      AND (
        (attachment_mime_type = 'image/jpeg' AND attachment_size_bytes BETWEEN 1 AND 524288)
        OR (attachment_mime_type = 'application/pdf' AND attachment_size_bytes BETWEEN 1 AND 3145728)
      )
    )
  );

ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_attachment_fields_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_attachment_fields_check
  CHECK (
    (attachment_path IS NULL AND attachment_mime_type IS NULL AND attachment_size_bytes IS NULL)
    OR (
      attachment_path IS NOT NULL
      AND attachment_mime_type IN ('image/jpeg', 'application/pdf')
      AND (
        (attachment_mime_type = 'image/jpeg' AND attachment_size_bytes BETWEEN 1 AND 524288)
        OR (attachment_mime_type = 'application/pdf' AND attachment_size_bytes BETWEEN 1 AND 3145728)
      )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notification-attachments',
  'notification-attachments',
  false,
  3145728,
  ARRAY['image/jpeg', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/jpeg', 'application/pdf']::text[];
