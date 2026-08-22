# PadhAI GitHub–Supabase Security Audit and Hardening Report

**Author:** Manus AI
**Audit date:** 22 August 2026
**Repository:** `devanshumrao9044/PadhAI`
**Branch:** `main`
**Supabase project:** `Padh AI` (`sligrtvwosldwhlnfyen`)
**Region/status:** `ap-south-1`, `ACTIVE_HEALTHY`

## Executive conclusion

The audit confirmed a real authorization defect: authenticated clients had direct table-level mutation capability over server-controlled progression data, and the active React Native context used those direct writes for focus sessions, daily summaries, XP transactions, and XP/streak profile fields. That design allowed a modified client to attempt forged XP, streak, session, or summary mutations even though normal UI flows did not expose those controls.

The defect is now hardened in production. Progression settlement is server-authoritative through the existing offline-sync RPC, with new timestamp, ownership, state, replay, membership, and concurrency checks. Direct authenticated DML was removed from the sensitive tables, while legitimate profile editing, tracker CRUD, notification-device ownership, report creation, and read paths remain available. No historical rows were deleted or rewritten.

The only remaining Supabase security-advisor warning is **Leaked Password Protection Disabled**. This is intentionally unchanged because the user explicitly excluded password-protection setting changes. The performance advisor has no remaining warnings; it reports only informational unused-index candidates, which were not removed without workload evidence.

## Scope and evidence

The audit covered repository code, migrations, production schema, RLS policies, function security/privileges, Storage bucket configuration, Supabase security and performance advisors, bounded production integrity aggregates, unauthenticated REST/RPC connectivity, TypeScript, lint, web export, and the automated test suite. Inspection queries selected only required columns and used bounded output with explicit `LIMIT` clauses.

The pre-fix repository baseline was commit `e4927e5`. The repository also contained pre-existing launch-crash diagnostics (`app.json`, `app/_layout.tsx`, `features/core/services/storage.ts`, and `package.json`); those changes remain intentionally uncommitted because the Samsung A14 Android 15 crash still requires device confirmation. They were not mixed into this security hardening commit.

## Confirmed findings and disposition

| Finding | Evidence-based impact | Disposition |
|---|---|---|
| Direct authenticated DML on `users`, `focus_sessions`, `daily_summary`, and `xp_transactions` | A modified client could attempt to forge progression, XP, streak, summaries, or sessions | Fixed in production with least-privilege grants and RPC-only settlement |
| `AppContext.tsx` directly wrote progression fields and retried them through a generic queue | Client-side writes could bypass the intended server settlement model; offline retries could preserve insecure payloads | Fixed in code; progression queue entries now use RPC operations or are safely discarded as legacy direct writes |
| Offline settlement did not bind wall-clock timestamps to elapsed duration and accepted future timestamps | Timestamp manipulation could make an offline payload appear longer or valid after clock changes | Fixed in the server RPC with future-time, wall-duration, elapsed-duration, and clock-anomaly checks |
| Focus/session payload ownership and subject/chapter/group membership required stronger server validation | A crafted request could reference another account’s tracker or group state | Fixed in the server RPC using `auth.uid()` and ownership/membership checks |
| Weekly XP marker was a direct `xp_transactions` upsert | Client could forge or replay weekly progression markers | Fixed with `record_weekly_xp_marker()` and an authenticated RPC-only path |
| Streak expiry and reward-popup acknowledgement used direct user updates | A client could attempt to alter server-controlled fields | Fixed with `mark_streak_broken()` and `mark_reward_popup_seen()` RPCs |
| Study-group presence used direct upsert/delete operations | Presence state could be forged or cleared for another member | Fixed with server-validated `update_study_group_presence()` and `clear_study_group_presence()` RPCs |
| Progression/state columns lacked several database-level bounds | Negative XP/streak/duration or invalid state combinations could be submitted by a privileged path | Fixed with 11 forward-only constraints after bounded pre-checks |
| Duplicate permissive report/ticket SELECT policies | Unnecessary policy evaluation overhead | Fixed by merging each pair into one equivalent policy |
| Public avatar bucket/readability | Public URLs remain readable without authentication; this is a product/privacy trade-off because the current UI uses `getPublicUrl` | Not changed in this audit; owner/path-based delete/update/upload controls remain enforced |
| Leaked-password protection disabled | Supabase advisor warning | Explicitly excluded; no Auth password setting was changed |

## Production migrations applied

The following tracked migrations were applied successfully to production and are present in the production migration history:

| Migration | Production version | Purpose |
|---|---:|---|
| `server_authoritative_security` | `20260822111641` | Server-authoritative progression RPCs, anti-replay/timestamp checks, least-privilege table grants, profile-column grants, presence RPCs, and sensitive policy cleanup |
| `data_integrity_constraints` | `20260822111809` | Numeric/state constraints and obsolete direct referral DML policy removal |
| `merge_group_select_policies` | `20260822112355` | Consolidated duplicate study-group report/ticket SELECT policies |

The migration was forward-only and idempotent where appropriate. Historical daily-summary drift and the two legitimate zero-amount weekly marker transactions were preserved.

## Production verification

Post-migration privilege checks returned the following results: authenticated users can select their own focus sessions, but cannot insert focus sessions directly; direct inserts into `daily_summary`, `xp_transactions`, and `referrals` are denied; authenticated users cannot update `users.xp` or `users.streak`; profile `users.name` updates remain allowed. RLS policy inspection showed owner-scoped reads and authenticated-only RPC execution for the hardened surfaces. Anonymous execution of the protected `users` REST path returned HTTP `401`, and anonymous execution of `get_leaderboard` returned HTTP `401`.

The bounded integrity re-check returned zero orphan chapters, zero orphan focus sessions, zero orphan XP transactions, and zero orphan daily summaries. It found two zero-amount XP rows, which match legitimate weekly baseline-marker semantics. The new migration installed all 11 requested constraints.

The final function audit confirmed that the public wrappers are not executable by `anon`, are executable by `authenticated`, and the private implementation functions use `SECURITY DEFINER` with fixed `search_path` settings. The final security advisor contains only the explicitly excluded leaked-password warning. The final performance advisor contains only informational unused-index notices; no performance warning remains.

## Repository verification

| Check | Result |
|---|---:|
| Automated tests | **71 passed, 0 failed** |
| TypeScript compilation (`pnpm exec tsc --noEmit`) | **Passed** |
| Application lint (`pnpm exec expo lint`) | **Passed** |
| Web export (`pnpm exec expo export --platform web`) | **Passed** |
| `git diff --check` | **Passed** |
| Unauthenticated protected REST/RPC checks | **HTTP 401 as expected** |

Added regression tests cover RPC-only progression writes, offline timestamp/state checks, profile-column restrictions, streak/reward RPC boundaries, and server-validated study-group presence.

## Not run or still requiring device verification

No Android emulator/device or `adb/logcat` is available in the sandbox. Therefore, the Samsung A14 Android 15 launch crash is **not claimed fixed** by this audit. Diagnostic APK 1.0.4 remains a separate, uncommitted crash-isolation build and still requires the user’s clean-install A/B result or a device crash trace.

An authenticated interactive test-account flow was not run because no dedicated test-account credential was configured in the sandbox. Production unauthenticated denial and static/RLS/function verification were completed; an authorized device test should still exercise profile editing, focus completion, offline reconnect, group presence, notification devices, avatar delete, and report/ticket flows.

## Explicit exclusions and remaining risks

Password strength and leaked-password protection were not enabled or modified. The Supabase advisor warning remains by explicit instruction. The public avatar bucket was not converted to private signed URLs because that would require a coordinated UI/data migration and device verification. Unused indexes were not dropped because advisor inactivity alone is insufficient workload evidence. This report does not claim that every possible bug was found; it records verified findings, verified fixes, tested surfaces, and remaining unavailable environments.

## References

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security documentation"
[2]: https://supabase.com/docs/guides/database/functions "Supabase Database Functions documentation"
[3]: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection "Supabase password strength and leaked-password protection"
[4]: https://supabase.com/docs/guides/database/database-linter "Supabase database advisor and linter guidance"
