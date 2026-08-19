BEGIN;

-- The Edge Function authenticates the caller itself, then uses the service role
-- only for its server-side recipient and notification materialization queries.
GRANT SELECT ON public.users TO service_role;
GRANT SELECT ON public.notification_admins TO service_role;
GRANT SELECT, INSERT ON public.notification_messages TO service_role;
GRANT SELECT, INSERT ON public.user_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_devices TO service_role;

COMMIT;
