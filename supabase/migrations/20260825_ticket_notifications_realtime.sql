-- Ticket replies are materialized as user_notifications. Publish that owner-scoped
-- table so the existing notification inbox can refresh while it is open.
DO $$
BEGIN
  IF to_regclass('public.user_notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'user_notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END;
$$;
