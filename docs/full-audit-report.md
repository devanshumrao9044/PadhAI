# PadhAI A-to-Z Bug Audit, Hardening, and Verification Report

**Author:** Manus AI  
**Audit date:** 16 August 2026  
**Project:** `devanshumrao9044/PadhAI`  
**Supabase project:** `sligrtvwosldwhlnfyen`  
**Environment:** Expo Router web preview, production Supabase REST/RPC endpoints, repository regression tooling

## Executive Summary

The PadhAI application and its production Supabase backend were audited across authentication, navigation, tracker persistence, chapter attribution, focus-session completion, XP and streak synchronization, deletion, analytics, profile, rank zones, themes, referrals, privacy-policy routing, input boundaries, RLS, and RPC authorization. Confirmed defects were fixed in the repository, the relevant database migrations were applied to production, and the critical flows were retested through the live web preview and direct production API probes.

The highest-impact findings were a post-relogin profile-hydration race, stale chapter rendering after persistence, stale chapter analytics after a completed focus session, an authenticated privacy-policy route being redirected to Home, and anonymous execution of referral lookup RPCs. The first four were fixed in application code. The referral RPC exposure was removed in production, and signup referral validation now relies on the atomic `handle_new_user` trigger so invalid codes remain rejected without an anonymous database lookup.

> **Current result:** The final repository regression passed, TypeScript is clean, Expo web export produced 28 static routes without the previous `index.web` route warning, production anonymous RPC probes now receive permission denied, and the repeated production harness completed ten iterations of each critical authentication/security path.

## Verified Fixes

| Area | Confirmed defect or risk | Implemented correction | Verification evidence |
|---|---|---|---|
| Authentication hydration | After logout and relogin, the dashboard could briefly display the generic `Student` fallback before the actual profile arrived. | Both native and web dashboards now gate rendering on `isLoading` and a hydrated `user`; the route guard performs navigation after profile hydration. | Relogin retest showed the correct `PadhAI Audit Valid` identity, and no final stale profile remained. |
| Tracker synchronization | A newly persisted chapter did not appear because the subject-detail selector was memoized against a stable callback. | The subject-detail chapter selector now recomputes from current AppContext chapter state. | `Kinematics Audit` appeared immediately after persistence and was confirmed in production. |
| Chapter analytics live sync | XP and daily summaries updated after a focus session, but Home initially showed no chapter-linked session. | Native and web Home dashboards now perform a mount/account-change `reload()` in addition to realtime subscriptions. | Home refreshed to show `Kinematics Audit`, `25m`, and `1 session · 1 completed`. |
| Privacy Policy routing | Authenticated Profile navigation to `/privacy-policy` was intercepted and returned Home. | AuthRouteGuard now allowlists `/privacy-policy` and `/reset-password` for active sessions. | The full policy opened in the authenticated dark-theme session and was readable. |
| Subject/chapter deletion | Subject deletion previously produced an RLS violation. | Existing deletion path was retested against the hardened policies; no new migration was required for this regression. | Subject and chapter deletion returned to the correct empty states; production rows were retained with `is_deleted = true`. |
| Referral security | `validate_referral_code` and `get_referrer_id` were callable anonymously. | Applied `20260816_revoke_anonymous_referral_rpc.sql`, revoked public/anonymous execution, and removed obsolete client-side lookup code. | Pre-hardening anonymous calls returned HTTP 200; post-hardening calls return HTTP 401 permission denied. |
| Signup referral behavior | Removing anonymous lookup could have regressed invalid-code handling. | Signup metadata is passed to the server-side trigger; AuthScreen and legacy SignupForm map trigger failures to field-local invalid-referral guidance. | UI signup with `BADCODE1` remained on the form with an inline message; production `auth.users` query returned no account. |
| Referral bonus authorization | `process_referral_bonus` accepted an arbitrary referee UUID from an authenticated caller. | Applied `20260816_harden_process_referral_bonus_auth.sql`; the function now requires `auth.uid() = p_referee_id`. | Ten authenticated calls for the signed-in audit user safely returned no-pending-referral responses. |
| Theme and profile history | Theme contrast and session-history count had previously been reported as inconsistent. | Existing dark/light palette and `getRecentSessions(..., 3)` behavior were retested; the dashboard refresh was also hardened. | Dark mode restored successfully, light mode remained readable, and Profile showed the latest two sessions under `LATEST 3`. |
| Expo routing warning | Export repeatedly reported `index.web` as an extraneous tab route. | Removed the explicit `index.web` screen registration from the tab layout while retaining the platform-specific file. | Final export produced 28 routes without the extraneous-route warning. |

## Production Data and Synchronization Evidence

The live audit account was `padhai.audit.valid.1625@example.com`. Two real focus sessions were completed through the normal application lifecycle. The first was a subject-only session and correctly stored `chapter_id = null` because the chapter selector remained on `General`. The second explicitly selected `Audit Physics` and `Kinematics Audit`; production stored `planned_minutes = 25`, `actual_minutes = 25`, `completed = true`, `broken = false`, `xp_earned = 50`, and the correct non-null `chapter_id`.

The chapter and subject deletion checks preserved historical data while excluding deleted content from active UI queries. Production confirmed `Kinematics Audit.is_deleted = true` and `Audit Physics.is_deleted = true`. Home subsequently showed `0/0 Chapters` and `No chapter-linked sessions yet`, while the historical focus rows remained available to the owner for integrity and audit history.

The completed sessions updated the user’s weekly XP to 80, daily focus to 40 minutes, and daily summary to two completed sessions. Profile displayed exactly the latest two rows within the explicit three-session cap, and the referral counters remained zero because the audit account had no pending referral.

## Security and Authorization Audit

A pre-hardening anonymous REST probe using only the publishable key demonstrated that `validate_referral_code('PADH13668')` returned HTTP 200 with `true`, and `get_referrer_id('PADH13668')` returned HTTP 200 with a referrer UUID. This confirmed the security-advisor finding that the referral lookup surface was externally callable.

The production migration revoked `PUBLIC`, `anon`, and `authenticated` execution for both lookup functions. A post-hardening anonymous probe returned HTTP 401 permission denied for both functions. Anonymous direct reads against `users`, `subjects`, `chapters`, and `focus_sessions` remained blocked. An authenticated owner-scoped probe returned exactly one user row for the audit account and no cross-user records.

The atomic referral bonus function remains an authenticated `SECURITY DEFINER` function because it must update both the referee and referrer in one transaction. Its authorization boundary was strengthened with an explicit current-user equality check. Supabase continues to report this intentional exposure as a warning because authenticated users can execute the function; the remaining risk is materially narrower than the original arbitrary-referee behavior.

Supabase’s other remaining security warning is **Leaked Password Protection Disabled**. This is an optional Supabase Auth dashboard setting rather than a database migration, and it was intentionally left unchanged after confirmation that it was not compulsory. The remediation is documented by Supabase in the password-security guidance [3].

The performance advisor reports six informational unused-index notices for ownership and referral indexes. They were not deleted because the indexes support the application’s owner-scoped queries and future workload; removal without production query-plan evidence would be premature. Supabase classifies this finding as an unused-index candidate rather than a correctness or security failure [4].

## Adversarial Input and RLS Results

A combined hostile subject value, `<img src=x onerror=alert(1)>OR1=1--`, was submitted through Tracker. It rendered literally in the subject list and detail header, produced no script execution, and caused no query-side behavior. The test subject was deleted afterward. The application persists through Supabase parameter APIs and renders user strings through native `Text` components rather than HTML injection.

Ten invalid-referral signup attempts were sent directly to production with `BADCODE1`. Every attempt returned the trigger error `P0001 Invalid referral code`, and the repeated emails were not created as auth users. Ten valid-password sign-in attempts all returned HTTP 200 access tokens. Ten authenticated `process_referral_bonus` calls for the current user returned safe no-op responses because no pending referral existed.

## Final Regression and Build Results

| Check | Result |
|---|---:|
| ESLint via `npm run lint` | Passed with no lint errors or warnings |
| TypeScript via `npx tsc --noEmit` | Passed |
| Automated TypeScript tests | 15 passed, 0 failed |
| Expo web export | Passed |
| Static routes | 28 exported |
| Extraneous `index.web` route warning | Resolved |
| Anonymous referral lookup probe after hardening | Both calls HTTP 401 |
| Repeated invalid signup attempts | 10/10 rejected |
| Repeated valid sign-ins | 10/10 successful |
| Repeated referral-bonus authorization calls | 10/10 safe no-op responses |

The Node test runner still emits non-blocking module-type and experimental type-stripping notices because the repository’s test files are TypeScript modules executed with Node’s experimental strip-types mode. These notices did not produce failures. Expo export also reports the normal Node `punycode` deprecation notice; the previous application-specific `index.web` warning is gone.

## Native Verification Limitation

The sandbox does not contain `adb`, an Android emulator binary, `ANDROID_HOME`, or `ANDROID_SDK_ROOT`. A real Android emulator/device run was therefore unavailable. Native risk was covered through shared React Native source inspection, TypeScript validation, linting, Expo static export, and platform-independent application logic. A final physical Android/iOS smoke test is still recommended before store release.

## Files and Production Migrations

The verified application changes are in the dashboard hydration, tracker selector, authentication route guard, authentication error handling, signup metadata flow, profile/theme behavior, referral service, legacy signup form, and tab layout. The applied production migrations are `20260816_revoke_anonymous_referral_rpc.sql` and `20260816_harden_process_referral_bonus_auth.sql`. The detailed running evidence remains in `docs/full-audit-auth-findings.md`, while production schema and advisor evidence remain in `docs/full-audit-schema-findings.md`.

## References

[1]: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable "Supabase database linter: anonymous SECURITY DEFINER functions"

[2]: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable "Supabase database linter: authenticated SECURITY DEFINER functions"

[3]: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection "Supabase Auth password security and leaked-password protection"

[4]: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index "Supabase database linter: unused indexes"
