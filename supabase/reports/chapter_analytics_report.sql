-- PadhAI chapter-wise analytics report
-- Read-only report. It does not insert, update, delete, or alter data.
--
-- Optional filters:
--   Replace NULL in the params CTE with a specific auth user UUID to scope
--   the report to one user. Leave it NULL for all users.
--   Replace the date bounds with DATE values to limit the reporting window.

-- 1) Main report: one row per active chapter, including chapters with no sessions.
WITH params AS (
  SELECT
    NULL::uuid AS requested_user_id,
    NULL::date AS start_date,
    NULL::date AS end_date
),
active_chapters AS (
  SELECT
    c.id AS chapter_id,
    c.user_id,
    c.subject_id,
    c.name AS chapter_name,
    c.status AS chapter_status,
    c.completed_date
  FROM public.chapters c
  CROSS JOIN params p
  WHERE c.is_deleted = false
    AND (p.requested_user_id IS NULL OR c.user_id = p.requested_user_id)
),
chapter_rollup AS (
  SELECT
    ac.chapter_id,
    ac.user_id,
    ac.subject_id,
    ac.chapter_name,
    ac.chapter_status,
    ac.completed_date,
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
  FROM active_chapters ac
  CROSS JOIN params p
  LEFT JOIN public.focus_sessions fs
    ON fs.chapter_id = ac.chapter_id
   AND (p.start_date IS NULL OR fs.started_at::date >= p.start_date)
   AND (p.end_date IS NULL OR fs.started_at::date <= p.end_date)
  GROUP BY
    ac.chapter_id,
    ac.user_id,
    ac.subject_id,
    ac.chapter_name,
    ac.chapter_status,
    ac.completed_date
)
SELECT
  chapter_id,
  user_id,
  subject_id,
  chapter_name,
  chapter_status,
  completed_date,
  total_sessions,
  completed_sessions,
  broken_sessions,
  total_minutes,
  planned_minutes,
  xp_earned,
  xp_deducted,
  average_session_minutes,
  first_session_at,
  last_session_at
FROM chapter_rollup
ORDER BY total_minutes DESC, total_sessions DESC, chapter_name ASC
LIMIT 500;

-- 2) Attribution coverage: shows how much focus-session data is linked to a chapter.
WITH params AS (
  SELECT
    NULL::uuid AS requested_user_id,
    NULL::date AS start_date,
    NULL::date AS end_date
),
scoped_sessions AS (
  SELECT fs.*
  FROM public.focus_sessions fs
  CROSS JOIN params p
  WHERE (p.requested_user_id IS NULL OR fs.user_id = p.requested_user_id)
    AND (p.start_date IS NULL OR fs.started_at::date >= p.start_date)
    AND (p.end_date IS NULL OR fs.started_at::date <= p.end_date)
)
SELECT
  COUNT(*)::bigint AS total_sessions,
  COUNT(*) FILTER (WHERE chapter_id IS NOT NULL)::bigint AS attributed_sessions,
  COUNT(*) FILTER (WHERE chapter_id IS NULL)::bigint AS unattributed_sessions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE chapter_id IS NOT NULL)
    / NULLIF(COUNT(*), 0),
    2
  ) AS attribution_rate_percent,
  COALESCE(SUM(actual_minutes), 0)::bigint AS total_minutes,
  COALESCE(SUM(actual_minutes) FILTER (WHERE chapter_id IS NOT NULL), 0)::bigint AS attributed_minutes,
  COALESCE(SUM(actual_minutes) FILTER (WHERE chapter_id IS NULL), 0)::bigint AS unattributed_minutes
FROM scoped_sessions
LIMIT 1;

-- 3) Unattributed session detail: useful for migration/backfill review.
WITH params AS (
  SELECT
    NULL::uuid AS requested_user_id,
    NULL::date AS start_date,
    NULL::date AS end_date
)
SELECT
  fs.id AS session_id,
  fs.user_id,
  fs.subject_id,
  fs.actual_minutes,
  fs.completed,
  fs.broken,
  fs.xp_earned,
  fs.xp_deducted,
  fs.started_at,
  fs.ended_at
FROM public.focus_sessions fs
CROSS JOIN params p
WHERE fs.chapter_id IS NULL
  AND (p.requested_user_id IS NULL OR fs.user_id = p.requested_user_id)
  AND (p.start_date IS NULL OR fs.started_at::date >= p.start_date)
  AND (p.end_date IS NULL OR fs.started_at::date <= p.end_date)
ORDER BY fs.started_at DESC
LIMIT 500;

-- 4) Deleted-chapter attribution audit: historical sessions whose chapter was
-- soft-deleted. They remain valid history but should not appear in active
-- weak-chapter cards.
SELECT
  fs.chapter_id,
  c.name AS chapter_name,
  c.user_id,
  c.is_deleted,
  COUNT(fs.id)::bigint AS total_sessions,
  COALESCE(SUM(fs.actual_minutes), 0)::bigint AS total_minutes,
  MAX(fs.started_at) AS last_session_at
FROM public.focus_sessions fs
JOIN public.chapters c ON c.id = fs.chapter_id
WHERE c.is_deleted = true
GROUP BY fs.chapter_id, c.name, c.user_id, c.is_deleted
ORDER BY total_minutes DESC, chapter_name ASC
LIMIT 500;
