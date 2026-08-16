-- Adds optional chapter attribution to focus sessions.
--
-- Safety properties:
--   * Existing focus_sessions rows remain valid and are not rewritten.
--   * chapter_id is nullable because historical sessions cannot be attributed
--     reliably from subject_id alone.
--   * Deleting a chapter preserves the study-session record and clears only its
--     chapter reference through ON DELETE SET NULL.
--   * The migration is safe to run again.

ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS chapter_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.focus_sessions'::regclass
      AND conname = 'focus_sessions_chapter_id_fkey'
  ) THEN
    ALTER TABLE public.focus_sessions
      ADD CONSTRAINT focus_sessions_chapter_id_fkey
      FOREIGN KEY (chapter_id)
      REFERENCES public.chapters (id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_chapter_id
  ON public.focus_sessions (chapter_id);

COMMENT ON COLUMN public.focus_sessions.chapter_id IS
  'Optional chapter associated with this focus session; historical rows may be NULL.';

-- Rollback, only after the application no longer reads or writes chapter_id:
--
-- DROP INDEX IF EXISTS public.idx_focus_sessions_chapter_id;
-- ALTER TABLE public.focus_sessions
--   DROP CONSTRAINT IF EXISTS focus_sessions_chapter_id_fkey;
-- ALTER TABLE public.focus_sessions
--   DROP COLUMN IF EXISTS chapter_id;
