-- User-scoped, read-only chapter analytics endpoint for the frontend.
-- The function returns active chapters only and preserves rows with no sessions.

CREATE OR REPLACE FUNCTION public.get_chapter_analytics(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  chapter_id uuid,
  subject_id uuid,
  chapter_name text,
  chapter_status text,
  total_sessions bigint,
  completed_sessions bigint,
  broken_sessions bigint,
  total_minutes bigint,
  planned_minutes bigint,
  xp_earned bigint,
  xp_deducted bigint,
  average_session_minutes numeric,
  first_session_at timestamptz,
  last_session_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS chapter_id,
    c.subject_id,
    c.name AS chapter_name,
    c.status AS chapter_status,
    COUNT(fs.id)::bigint AS total_sessions,
    COUNT(fs.id) FILTER (WHERE fs.completed = true AND fs.broken = false)::bigint AS completed_sessions,
    COUNT(fs.id) FILTER (WHERE fs.broken = true)::bigint AS broken_sessions,
    COALESCE(SUM(fs.actual_minutes), 0)::bigint AS total_minutes,
    COALESCE(SUM(fs.planned_minutes), 0)::bigint AS planned_minutes,
    COALESCE(SUM(fs.xp_earned), 0)::bigint AS xp_earned,
    COALESCE(SUM(fs.xp_deducted), 0)::bigint AS xp_deducted,
    ROUND(AVG(fs.actual_minutes) FILTER (WHERE fs.id IS NOT NULL), 2) AS average_session_minutes,
    MIN(fs.started_at) AS first_session_at,
    MAX(fs.started_at) AS last_session_at
  FROM public.chapters c
  LEFT JOIN public.focus_sessions fs
    ON fs.chapter_id = c.id
   AND fs.user_id = auth.uid()
   AND (p_start_date IS NULL OR fs.started_at::date >= p_start_date)
   AND (p_end_date IS NULL OR fs.started_at::date <= p_end_date)
  WHERE c.user_id = auth.uid()
    AND c.is_deleted = false
  GROUP BY c.id, c.subject_id, c.name, c.status
  ORDER BY total_minutes DESC, total_sessions DESC, c.name ASC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.get_chapter_analytics(date, date) TO authenticated;

COMMENT ON FUNCTION public.get_chapter_analytics(date, date) IS
  'Returns active chapter-level focus analytics for the authenticated user, optionally filtered by start and end dates.';
