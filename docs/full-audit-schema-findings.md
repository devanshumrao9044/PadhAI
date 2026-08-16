# Full Audit – Production Schema Findings

**Source:** Production Supabase project `sligrtvwosldwhlnfyen`, inspected 2026-08-16.

The public schema contains RLS-enabled tables for `users`, `subjects`, `chapters`, `focus_sessions`, `xp_transactions`, `daily_summary`, `blocked_apps`, and `referrals`. The production table row counts reported by the schema inspection were: `users` 3, `subjects` 1, `chapters` 1, `focus_sessions` 2, `xp_transactions` 9, `daily_summary` 3, `blocked_apps` 0, and `referrals` 1.

The `users` table has UUID primary key `id` linked to `auth.users.id`, a unique nullable `my_referral_code`, and UUID `referred_by` linked back to `users.id`. It does not contain the removed referral-expiration column. `referrals.referee_id` is unique, and referral status is constrained to `pending` or `completed`; the table also tracks `xp_awarded` and `completed_at`.

`chapters` includes `is_deleted` and has a foreign key from `focus_sessions.chapter_id` to `chapters.id`. `focus_sessions` includes `chapter_id`, session completion/broken flags, XP fields, timestamps, and user/subject foreign keys. All inspected public tables had RLS enabled.

Foreign-key relationships were present for user ownership, chapter attribution, referrals, and XP transactions. Further audit work is required for policy definitions, indexes, grants, RPC security, trigger behavior, data invariants, and live authorization attempts.


## Supabase Security Advisor Findings

The production security advisor reported six warnings. `public.get_referrer_id(code text)` is executable by both `anon` and `authenticated` roles while marked `SECURITY DEFINER`. `public.validate_referral_code(code text)` is also executable by both roles while marked `SECURITY DEFINER`. `public.process_referral_bonus(p_referee_id uuid)` is executable by `authenticated` while marked `SECURITY DEFINER`. The advisor also reports that leaked-password protection is disabled in Supabase Auth. These are audit findings requiring authorization and abuse testing before any production change; the advisor supplied remediation references for each finding.

Advisor references:

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection


## Live Anonymous Authorization Probe

A REST probe using only the publishable anonymous key found that `validate_referral_code('PADH13668')` returned HTTP 200 and `true`, and `get_referrer_id('PADH13668')` returned HTTP 200 with the referrer's UUID. This confirms the two previously flagged referral RPC exposure findings are live in production and can be invoked without a user session. The anonymous probe could not read `users`, `subjects`, `chapters`, or `focus_sessions`; each table returned HTTP 401 with `permission denied`, so table-level data access remains blocked.

The anonymous call to `get_chapter_analytics` returned HTTP 401 because the anonymous role lacks table privileges, which is consistent with its authenticated-only grant. The referral RPCs remain the high-priority authorization issue to remediate in the next database-hardening phase.

An authenticated REST probe using the disposable audit account returned one `users` row for that account, only its own subject/chapter/focus/XP/daily-summary records, and an empty referrals result. Soft-deleted subjects and chapters were still visible to the owner because the probe intentionally selected the base tables; the app’s active queries add `is_deleted = false`, which is why deleted content is absent from the UI. No cross-user records were exposed by the owner-scoped RLS reads.

The referral hardening migration was applied to production. A second anonymous REST probe now returns HTTP 401 `permission denied for function` for both `validate_referral_code` and `get_referrer_id`, while the existing table/RPC denial behavior remains unchanged. `process_referral_bonus` now also requires `auth.uid() = p_referee_id`; Supabase’s only remaining database warning for it is the intentional authenticated SECURITY DEFINER exposure needed for an atomic cross-user XP write.

## Supabase Performance Advisor Findings

The production performance advisor reported six informational unused-index findings: `idx_subjects_user_id`, `idx_chapters_user_id`, `idx_focus_sessions_user_id`, `idx_daily_summary_user_id`, `idx_xp_transactions_user_id`, and `idx_users_referred_by`. These are candidates for review, not automatic deletion; the audit should compare them with actual query plans and workload before changing indexes.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
