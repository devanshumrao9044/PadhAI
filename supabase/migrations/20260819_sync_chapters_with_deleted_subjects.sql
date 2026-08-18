-- Keep chapter visibility synchronized with soft-deleted parent subjects.
-- This preserves historical rows while preventing deleted subjects' chapters from
-- appearing in Tracker and Analytics queries.
UPDATE public.chapters AS c
SET is_deleted = true
WHERE c.is_deleted = false
  AND EXISTS (
    SELECT 1
    FROM public.subjects AS s
    WHERE s.id = c.subject_id
      AND s.is_deleted = true
  );
