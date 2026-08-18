-- Keep chapter analytics callable only by authenticated users.
-- The function is SECURITY INVOKER and already filters by auth.uid(), but
-- anonymous/public execute access is unnecessary and should not be exposed.
BEGIN;

REVOKE ALL ON FUNCTION public.get_chapter_analytics(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chapter_analytics(date, date) TO authenticated;

COMMIT;
