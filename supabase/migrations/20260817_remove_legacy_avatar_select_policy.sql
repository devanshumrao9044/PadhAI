-- Remove the legacy avatar SELECT policy so only the path-and-owner scoped rule remains.
DROP POLICY IF EXISTS "Users can only select their own avatars" ON storage.objects;
