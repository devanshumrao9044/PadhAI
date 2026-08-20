# PadhAI A-to-Z Security and Reliability Audit

**Author:** Manus AI
**Date:** 20 August 2026
**Repository:** `devanshumrao9044/PadhAI`
**Branch:** `main`
**Supabase project:** `sligrtvwosldwhlnfyen` (`ap-south-1`)
**Audit baseline:** `e08472461528302357311f0faadba885b0c889ca`

## Executive summary

The PadhAI repository and its production Supabase project were reviewed together rather than as isolated code and database systems. The audit covered authentication and route protection, session persistence, client-to-Supabase access, RLS, SECURITY DEFINER RPCs, Storage, data-integrity invariants, notification attachment limits, Study Groups moderation, static attacker-oriented patterns, tests, TypeScript, linting, and the Expo web bundle.

The confirmed actionable defects found during the audit were fixed and applied to production. The six missing Study Groups foreign-key indexes were added. The overlapping `study_group_presence` SELECT policy was replaced with one scoped SELECT policy plus three explicit owner-scoped write policies. The Study Groups privileged implementations were moved into the private schema and replaced at the public API boundary by SECURITY INVOKER wrappers, while preserving the existing RPC names and client signatures. Legacy authentication files now carry a prominent warning that they are outside the active route tree.

The final production security advisor reports only **Leaked Password Protection Disabled**. This setting was explicitly excluded from changes by the product requirement; the six-character minimum also remains unchanged. No new security or data-integrity defect was introduced by the audit fixes.

> **Verdict:** The repository and production database are synchronized with the verified audit fixes. The remaining advisor warning is intentionally excluded, and the web session-token limitation remains an architectural limitation of the current direct Expo client rather than an unimplemented claim of HttpOnly-cookie support.

## Scope and evidence

The audit used the GitHub `main` checkout, the deployed Supabase production project, the repository's existing unit and integration tests, static source scans, and a production migration/advisor re-audit. No credentials were written to source, reports, migrations, or test artifacts. The audit did not alter password-protection settings, user passwords, or application data.

| Area | Evidence collected | Final result |
|---|---|---|
| Repository and source tree | Git status, diff review, route-reference scan, credential/sink scans | Only intended audit files changed; no active route imports legacy auth files; no credential or unsafe HTML/eval pattern was found in the scanned source |
| Authentication | Active `AuthSessionProvider`, `AuthRouteGuard`, password policy, prior hardening report, production Auth-user metadata | Active path is centralized; all three production users were confirmed; unconfirmed-user count is zero |
| Supabase RLS | Production `pg_class` and `pg_policies` inventory | 0 public tables with RLS disabled, 0 anonymous policies, 0 public policies, 0 public tables without a policy; authenticated-policy inventory remained 46 |
| RPC security | Production `pg_proc`, privileges, definitions, and advisors | Public Study Groups RPCs are SECURITY INVOKER wrappers; privileged implementations are private SECURITY DEFINER functions with fixed search paths and authenticated-only execution |
| Storage | Production bucket configuration and prior upload-policy verification | Avatar and notification attachment limits remain enforced and compatible with the app compression policies |
| Data integrity | Bounded production invariant query | All 14 checked invariants returned 0 issues |
| Automated regression | `pnpm test`, ten complete passes after final hardening | 59/59 tests passed in each of 10 runs; 590 individual test cases passed |
| Build gates | TypeScript, Expo lint, Expo web export, `git diff --check` | All passed; web export produced 41 static routes |
| Native E2E capability | Bounded probes for `adb`, Android emulator, Maestro, Detox | Not runnable in this sandbox because all four device/E2E tools are unavailable |

## Confirmed fixes applied

### Study Groups foreign-key indexes

The tracked migration `supabase/migrations/20260820_study_groups_fk_indexes.sql` adds the six indexes identified by the production performance advisor:

| Index | Column |
|---|---|
| `study_group_invites_created_by_idx` | `study_group_invites.created_by` |
| `study_group_presence_user_id_idx` | `study_group_presence.user_id` |
| `study_group_reports_reported_user_id_idx` | `study_group_reports.reported_user_id` |
| `study_group_reports_reviewed_by_idx` | `study_group_reports.reviewed_by` |
| `study_group_tickets_group_id_idx` | `study_group_tickets.group_id` |
| `study_group_tickets_report_id_idx` | `study_group_tickets.report_id` |

The migration was applied successfully and is recorded in production as `study_groups_fk_indexes` at version `20260820180428`. The advisor no longer reports missing foreign-key indexes; it reports only informational unused-index notices, including the newly created indexes. Those informational notices are retained because they are valid foreign-key and authorization-support indexes and should not be removed merely because current production traffic has not exercised every path.

### Presence policy consolidation

The production policy inspection showed that `study_group_presence_owner_write` was an `ALL` policy and therefore overlapped with the broader scoped SELECT policy. The migration drops that `ALL` policy and creates three explicit policies: `study_group_presence_owner_insert`, `study_group_presence_owner_update`, and `study_group_presence_owner_delete`. The existing `study_group_presence_scoped_select` policy remains the only SELECT policy.

The final production check returned the following policy shape:

| Check | Result |
|---|---:|
| Presence SELECT policies | 1 |
| Explicit owner write policies | 3 |
| Presence `ALL` policies | 0 |

The owner checks remain `auth.uid()`-based and require Study Groups membership, so the consolidation reduces policy overlap without broadening write access.

### Study Groups SECURITY DEFINER exposure

The security advisor initially surfaced warnings because authenticated users could execute exposed `public.*` Study Groups functions that were SECURITY DEFINER. The production definitions were inspected individually. Every affected function had a fixed search path and internal authentication, membership, admin, or PadhAI-owner checks, but the exposed SECURITY DEFINER boundary was still unnecessarily broad from an advisor and maintenance perspective.

The tracked migration `supabase/migrations/20260820_hide_study_group_security_definers.sql` therefore moves the 13 privileged implementations into the `private` schema and recreates the same public RPC names as SECURITY INVOKER wrappers. The wrapper signatures preserve the existing app calls. Private implementations remain callable only by authenticated users, anonymous execution is revoked, and the implementation-level authorization checks remain in place.

The final production inspection confirmed that:

| RPC layer | SECURITY DEFINER | Anonymous execute | Authenticated execute |
|---|---:|---:|---:|
| Public Study Groups wrappers | 0 | 0 | 13 |
| Private Study Groups implementations/helpers | 16 | 0 | 16 |

The final security advisor now contains no Study Groups SECURITY DEFINER warning. The migration is recorded in production as `hide_study_group_security_definers` at version `20260820181532`.

### Legacy authentication maintenance warnings

The following files are not imported by the active Expo Router auth route tree and now contain the same prominent warning:

- `components/auth/SignupForm.tsx`
- `components/auth/LoginForm.tsx`
- `legacy/auth/LegacyAuthScreen.tsx`

The warning identifies `auth/AuthScreen.tsx` and `auth/AuthSessionProvider.tsx` as the active path and explicitly says not to add new authentication logic to the legacy files. No active route reference to these legacy auth files was found in the route/source scan.

### Intentional Edge Function JWT configuration

The deployed `send-admin-notification` Edge Function uses `verify_jwt: false` intentionally for native and web-client compatibility. This is not treated as an authorization bypass. The function manually extracts the Bearer token, validates it with `auth.getUser(accessToken)`, and performs a server-side role lookup in `notification_admins` before allowing notification operations. The function's service-role capability is confined to the deployed server-side environment and no service-role secret is stored in the repository.

## Production security and integrity results

### RLS and privilege boundaries

The final RLS inventory returned zero public tables without RLS, zero anonymous policies, zero public policies, and zero public tables lacking any policy. The application remains owner/member scoped through authenticated policies. The Study Groups public RPC wrappers are authenticated-only, and the privileged private implementations are not anonymous-executable.

### Data-integrity invariants

Every bounded production integrity check returned zero issues:

| Invariant | Issues |
|---|---:|
| Unconfirmed Auth users | 0 |
| Focus sessions missing a user | 0 |
| Focus-session/chapter user mismatch | 0 |
| Chapters missing a user | 0 |
| Subjects missing an Auth user | 0 |
| Referral self-reference | 0 |
| Referrals missing a referrer | 0 |
| Referrals missing a referee | 0 |
| Study Group owners missing owner membership | 0 |
| Study Group session/focus-user mismatch | 0 |
| Reports submitted by non-members | 0 |
| Tickets whose report owner does not match | 0 |
| Oversized admin notification attachments | 0 |
| Oversized user notification attachments | 0 |

The production Auth-user check also showed three users, all with `email_confirmed_at` set, none banned, and none deleted. No test account or production row was created by the final audit.

### Storage and upload controls

The previously verified production Storage controls remain in force. The `avatars` bucket is public for image display but restricts files to JPEG and 256 KiB. The private `notification-attachments` bucket restricts files to JPEG/PDF and 3 MiB. Application-side avatar, notification-image, and PDF compression policies remain covered by the existing tests and the production attachment-integrity checks above.

## Authentication findings and limitations

### Session storage on web

The current project is a direct Expo client with native AsyncStorage and a browser SPA storage adapter. It has no SSR runtime or server response layer capable of setting and refreshing HttpOnly cookies. A true `Secure; HttpOnly; SameSite=Lax` migration therefore cannot be completed safely inside this architecture by adding `@supabase/ssr` to the direct client. The web session remains readable by JavaScript through the browser storage adapter. This limitation is documented in `features/core/services/supabase.ts` and the prior hardening report.

If the project later introduces a server-capable web deployment, the web path should use a server Supabase client, PKCE, and server-set Secure/HttpOnly/SameSite cookies while retaining the native device-storage path for Expo. The current app does not falsely claim to have completed that migration. Supabase's server-side guidance and Expo's direct-client guidance describe these different deployment models [1] [2].

### Email verification

Application and database gates for confirmed email are implemented. The active auth provider checks `email_confirmed_at`, signs out unconfirmed sessions, and the route guard rejects persisted unconfirmed sessions. The production invariant query found zero unconfirmed users. The provider-level Confirm Email toggle remains a dashboard-controlled setting and was not changed during this audit because no dashboard setting change was requested or required for the code/database fixes.

### Rate limiting

The app preserves Supabase Auth's provider-level throttling and maps throttling responses to retry-later UX. A custom IP-plus-email lockout was not added because the direct Expo app has no server runtime; a client-only counter would be bypassable and would not constitute reliable security. Supabase's Auth rate-limit documentation remains the authoritative provider reference [3].

### Password policy and excluded setting

The application password policy still requires a minimum of six characters plus mixed character classes. The six-character minimum was not increased. The final security advisor's only remaining warning is **Leaked Password Protection Disabled**. This was explicitly excluded from changes by the product requirement, so the audit reports it without changing it. Supabase documents this setting as a provider/dashboard control [4].

## Regression and build verification

The deterministic test suite was run ten times after the final database hardening migration. Each pass reported 59 tests, 59 passes, and zero failures, cancellations, or skips. TypeScript completed with no errors. Expo lint completed successfully. `git diff --check` completed successfully. A fresh Expo web export completed successfully and generated 41 static routes.

The repository's Maestro flow is present at `.maestro/leaderboard-rank-transition.yaml`, but this sandbox does not contain `adb`, an Android emulator, Maestro, or Detox. Therefore, no claim is made that native Android, iOS, or physical-device E2E coverage was executed here. The documented runner also requires a disposable confirmed account supplied through environment variables; no credentials were stored in the repository or audit artifacts.

## Remaining items and recommended follow-up

| Item | Status | Owner/action |
|---|---|---|
| Enable leaked-password protection | **Excluded by requirement** | Change only if the product owner later authorizes the Supabase Auth dashboard setting; this is the sole remaining security advisor warning |
| Move web sessions to HttpOnly cookies | **Architectural limitation** | Introduce a server-capable web runtime first; do not attempt to retrofit SSR cookies into the current direct Expo client |
| Native device E2E | **Unavailable in this sandbox** | Run the existing Maestro flow on a machine with Android tooling and a disposable confirmed account; add iOS coverage separately if desired |
| Informational unused-index notices | **Retained intentionally** | Revisit only with workload evidence; do not remove owner/FK/RLS-support indexes solely because current traffic is light |

## References

[1]: https://supabase.com/docs/guides/auth/server-side/advanced-guide "Supabase Auth SSR advanced guide"
[2]: https://docs.expo.dev/guides/using-supabase/ "Expo: Using Supabase"
[3]: https://supabase.com/docs/guides/auth/rate-limits "Supabase Auth rate limits"
[4]: https://supabase.com/docs/guides/auth/password-security "Supabase Auth password security"
[5]: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable "Supabase SECURITY DEFINER advisor"
[6]: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index "Supabase unused-index advisor"
