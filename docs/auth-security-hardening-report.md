# PadhAI Authentication Security Hardening Report

**Author:** Manus AI
**Date:** 17 August 2026
**Repository:** `devanshumrao9044/PadhAI`
**Supabase project:** `sligrtvwosldwhlnfyen`

## Executive Summary

The five supplied security recommendations were audited against the actual PadhAI architecture. The app is an Expo Router / React Native client that connects directly to Supabase; it is not an SSR application and has no server route, server action, middleware, or admin API. As a result, some recommendations map directly to code and RLS changes, while true browser `HttpOnly` cookies and Supabase Auth provider settings require a separate server runtime or dashboard access.

The application-side and database-side protections were implemented and verified. The final production Supabase security advisor has one remaining warning: **Leaked Password Protection Disabled**. The previous warning for the authenticated `SECURITY DEFINER` referral RPC was removed by moving the privileged implementation into the private schema behind an authenticated `SECURITY INVOKER` public wrapper.

## Status by Recommendation

| Recommendation | Implementation status | Verification and limitation |
|---|---|---|
| Session token in `localStorage` | **Not converted to HttpOnly cookies** | The project is a direct Expo client with a static web build and no server runtime. `@supabase/ssr` cannot create HttpOnly cookies in this architecture. The browser session remains JavaScript-readable through Supabase’s SPA storage adapter; this is documented explicitly rather than falsely claiming a cookie migration. |
| Admin authorization only client-side | **Hardened** | No admin route, admin role, service-role key, or server action exists in the repository. All exposed tables use owner-scoped authenticated RLS. Referral bonus execution now uses a public invoker wrapper and a private definer implementation with a caller/referee identity check. |
| Missing email verification | **Application and database gates implemented; provider setting pending** | Signup and login revoke unconfirmed sessions, the route guard rejects persisted unconfirmed sessions, and a resend-confirmation action was added. Production restrictive RLS reads `auth.users.email_confirmed_at` through a private helper. A live signup probe showed that the provider currently auto-confirms accounts, so the Supabase Dashboard’s **Confirm email** setting still must be enabled for provider-level enforcement. |
| Missing rate limiting | **Supabase built-in protection preserved; UX hardened** | Supabase Auth’s built-in throttles remain the authoritative control. Login, signup, reset, and resend flows now map rate-limit responses to a retry-later message. A custom 5-attempt/IP+email lockout was not added because the app has no server runtime and a client-only counter would be bypassable. |
| Weak/leaked passwords | **Client policy implemented; provider leaked-password setting pending** | Signup requires at least six characters plus uppercase, lowercase, number, and symbol. Provider weak-password/leaked-password errors are mapped to a clear field-local message. Supabase’s leaked-password setting remains disabled because it is dashboard-controlled and the dashboard login was blocked by hCaptcha. |

## Implemented Code Changes

`auth/passwordPolicy.ts` now centralizes the six-character minimum, mixed-character guidance, and provider leaked-password error mapping. `AuthScreen.tsx` and the legacy `SignupForm.tsx` use this policy, and the live preview confirmed that errors appear directly below the password field.

`AuthSessionProvider.tsx` now checks `email_confirmed_at` after password login, signs out unconfirmed sessions, exposes `resendSignupConfirmation()`, and signs out a signup session when Supabase returns an unconfirmed session. `AuthRouteGuard.tsx` performs a startup check so a persisted unconfirmed session cannot mount protected screens. `LoginForm.tsx` and `SignupForm.tsx` were updated as well so legacy authentication paths do not bypass the verification gate.

The legacy reset flow no longer queries `public.users` to determine whether an account exists, preventing unnecessary account-existence disclosure. Auth throttling errors are mapped to a generic retry-later message, and reset errors use field-local guidance.

`services/supabase.ts` documents the architectural boundary: the current direct Expo client uses native AsyncStorage and a browser SPA storage adapter. A true HttpOnly migration requires a server-side web application that can set and refresh cookies; adding `@supabase/ssr` to this direct client would not achieve that goal and could break native behavior.

## Production Database Changes

The migration `20260816_require_confirmed_email.sql` creates the private `private.is_email_confirmed()` SECURITY DEFINER helper and applies restrictive authenticated policies to `users`, `subjects`, `chapters`, `focus_sessions`, `daily_summary`, `xp_transactions`, `referrals`, and `blocked_apps`. The helper reads `auth.users` server-side and does not trust editable user metadata or a non-standard JWT claim.

The migration `20260817_hide_referral_bonus_definer.sql` moves the privileged referral-bonus implementation to `private.process_referral_bonus()` and leaves `public.process_referral_bonus()` as an authenticated SECURITY INVOKER wrapper. Anonymous execution is revoked for both functions. Cross-user invocation is rejected with `Unauthorized referee.`.

## Production Verification Evidence

The production RLS inventory showed authenticated owner-scoped policies on all application tables and no anonymous data policy. A confirmed audit account retained access to its own `users`, `subjects`, `chapters`, and `focus_sessions` rows after the email-confirmation RLS migration.

A disposable signup probe showed the current provider behavior: signup returned HTTP 200, an immediate session, and a non-null `email_confirmed_at`. This demonstrates that the provider-level Confirm email setting is currently disabled or configured for automatic confirmation. The disposable account was deleted immediately after the probe.

The referral RPC probe returned `No pending referral found for user.` for a legitimate self-call and `Unauthorized referee.` for a different user ID. The final privilege query showed `security_definer = false` and `anon_execute = false` for the public wrapper, while the private implementation is not anonymously executable.

## HttpOnly Cookie Decision

> Supabase’s official SSR guide describes secure cookies as an SSR/server architecture concern and states that browser-side code normally needs access to the refresh token for client session maintenance [1]. Expo’s official Supabase guide uses a direct client and a device persistence adapter for React Native apps [2].

Therefore, the current app should not be changed to `@supabase/ssr` without first introducing a server-capable web deployment. If the project later adds a web server, the correct migration is to create a server Supabase client with `@supabase/ssr`, use PKCE, set `Secure; HttpOnly; SameSite=Lax` cookies from server responses, and keep native Expo authentication on its device storage path. In the current static web build, DevTools will continue to show the Supabase session in the browser storage adapter; this is a known architectural limitation, not an unverified security claim.

## Verification Results

The final automated run passed **18 tests**, with **0 failures**. ESLint completed cleanly, TypeScript completed with no errors, and Expo web export completed successfully with **28 static routes**. The live web preview verified both password errors: a five-character password produced the six-character minimum message, and a six-character `abcdef` password produced the mixed-character guidance below the password field.

The remaining Supabase performance advisor notices are six informational unused-index messages for owner-ID indexes. They are retained because the indexes support current and future owner-scoped query patterns; they are not security failures.

## Dashboard Actions Still Pending

The Supabase dashboard must be used to enable **Confirm email** under Authentication → Providers → Email. The dashboard should also set the provider’s minimum length to at least six and enable leaked-password protection if the project plan supports it. The latter remains the only final security-advisor warning. Automated dashboard login could not be completed because Supabase presented an hCaptcha challenge; no credentials were stored in the repository or audit files.

## References

[1]: https://supabase.com/docs/guides/auth/server-side/advanced-guide "Supabase Auth SSR advanced guide"

[2]: https://docs.expo.dev/guides/using-supabase/ "Expo: Using Supabase"

[3]: https://supabase.com/docs/guides/auth/rate-limits "Supabase Auth rate limits"

[4]: https://supabase.com/docs/guides/auth/password-security "Supabase Auth password security"

[5]: https://supabase.com/docs/guides/auth/jwt-fields "Supabase JWT claims reference"
