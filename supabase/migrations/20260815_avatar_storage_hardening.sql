-- Remove bucket-wide public listing for avatar objects.
-- The avatars bucket remains public so existing getPublicUrl() image URLs keep working.
-- Owner-scoped authenticated SELECT/INSERT/UPDATE/DELETE policies remain unchanged.
BEGIN;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

COMMIT;

-- Verification target:
-- public SELECT on storage.objects for bucket avatars must be absent;
-- storage.buckets.public remains true for direct object URL access.

