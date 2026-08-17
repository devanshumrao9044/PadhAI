-- Least-privilege RLS for profile avatars.
-- Avatar objects are stored as <auth.uid()>/<auth.uid>-<timestamp>.jpeg.
-- The bucket remains public for existing getPublicUrl() profile rendering;
-- this migration protects object mutations and authenticated Storage API reads.
BEGIN;

DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can select their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

CREATE POLICY "Users can select their own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = (SELECT auth.uid())::text
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT private.is_email_confirmed())
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = (SELECT auth.uid())::text
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT private.is_email_confirmed())
)
WITH CHECK (
  bucket_id = 'avatars'
  AND owner_id = (SELECT auth.uid())::text
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT private.is_email_confirmed())
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = (SELECT auth.uid())::text
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (SELECT private.is_email_confirmed())
);

COMMIT;
