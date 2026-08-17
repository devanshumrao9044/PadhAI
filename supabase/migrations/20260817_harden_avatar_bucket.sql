-- Keep profile avatars compact and compatible with the client-side JPEG pipeline.
-- The client targets 200 KiB and the bucket leaves a 56 KiB enforcement buffer.
update storage.buckets
set file_size_limit = 262144,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'avatars';
