# Authentication Security Audit — Follow-up Findings

**Audit scope:** PadhAI Expo Router / React Native app with direct Supabase client access.
**Date:** 16 August 2026.

## Architecture Finding: HttpOnly Cookies Are Not a Drop-In Change for This App

The current client is a direct Supabase client. On web it supplies a custom `localStorage` adapter, while native uses AsyncStorage. `AuthSessionProvider` calls `supabase.auth.getSession()`, `onAuthStateChange()`, `signInWithPassword()`, `signUp()`, and `resetPasswordForEmail()` directly from the Expo client. The root layout has no server runtime, API route, server action, middleware, or `@supabase/ssr` integration.

Official Supabase SSR guidance says browser/server cookie storage is for an SSR architecture and notes that `@supabase/ssr` automatically uses cookies, while its FAQ states that HttpOnly is not required because browser-side code needs access to the refresh token for normal client session maintenance [1]. Official Expo guidance for a React Native app uses a direct client and a device persistence adapter, with Supabase REST/RLS requests made directly and no server in between [2]. Therefore, blindly adding `@supabase/ssr` to this static Expo app would not produce HttpOnly cookies; it would either break persistence or require a separate server-capable web architecture.

The security decision is to preserve the native direct-client architecture, avoid claiming that an HttpOnly migration has been completed, and treat a true HttpOnly web session as a separate future web-server migration. The current web session is readable by JavaScript through the Supabase client storage adapter; the main compensating controls are strict RLS, parameterized data access, no HTML injection, and no client-trusted admin role.

## Authorization Finding

The repository contains no admin role, admin UI, server action, API route, route handler, service-role key, or secret key. All application data calls use the publishable/anon Supabase client and are protected by database RLS. The route guard is a navigation convenience, not a security boundary; the database policies and RPC authorization are the actual enforcement layer. The previously hardened `process_referral_bonus` RPC requires `auth.uid() = p_referee_id`, and owner-scoped tables use authenticated-user policies.

## Email Verification Finding

`AuthSessionProvider.signUp()` already returns `requiresEmailConfirmation` when Supabase returns no session, and `AuthScreen` displays a verification message and returns to login. However, the route guard does not explicitly enforce `email_confirmed_at` for every sensitive action. Supabase’s Expo documentation states that hosted projects confirm email addresses by default and that signup returns a null session until confirmation unless the provider setting is disabled [2]. The production setting must be verified in the Supabase Auth dashboard; code should also treat an unconfirmed session as restricted if the provider allows such sessions.

## Rate-Limiting Finding

The app has no custom IP+email lockout middleware because it has no server. Supabase Auth itself applies endpoint rate limits and returns HTTP 429 when limits are exceeded. Official documentation states that rate limits use a token-bucket model, are primarily IP/project scoped, and that signup and password-reset confirmation requests have a default 60-second per-user window; built-in email delivery is limited to two emails per hour unless custom SMTP is used [3]. The app should map 429 responses to a clear retry-later message and avoid adding a misleading client-only counter that attackers can bypass.

## Password Policy Finding

The active AuthScreen and legacy SignupForm enforce a minimum of six characters in the client. The requested clarified minimum is six. Supabase supports server-side minimum length, required character classes, and HaveIBeenPwned leaked-password rejection through Auth settings; its documentation recommends a minimum of at least eight characters, while the project requirement remains six [4]. Client validation must remain a UX aid only; the Supabase provider setting is the authoritative check. Leaked-password protection is a provider setting, not a SQL migration, and availability depends on the Supabase plan [4].

## Production Evidence

The production RLS inventory contains authenticated owner-scoped policies for `users`, `subjects`, `chapters`, `focus_sessions`, `daily_summary`, `xp_transactions`, `referrals`, and `blocked_apps`; no public admin role or client-trusted role check was found. A confirmed audit account successfully logged in and retained owner-scoped access to all four checked tables after the new restrictive policy was applied.

A disposable signup probe showed that the current Supabase project creates a new account with an immediate session and a non-null `email_confirmed_at` timestamp. This proves the provider-level **Confirm email** setting is currently disabled or otherwise configured to auto-confirm accounts. The application now signs out any signup session whose user object is not confirmed, blocks unconfirmed password login, exposes a resend-confirmation action, and the production database has restrictive policies that deny data access unless `auth.users.email_confirmed_at` is non-null. The disposable probe account was removed from production after the test.

The live Expo web preview verified both client-side password errors without contacting Supabase: a five-character password produced `Password must be at least 6 characters.`, and a six-character `abcdef` password produced `Use at least one uppercase letter, one lowercase letter, one number, and one symbol.` directly below the password field.

Supabase’s current JWT reference does not list `email_confirmed_at` as a standard JWT claim [5], so the database policy correctly reads `auth.users` through a private server-side helper instead of trusting user metadata or an unverified client claim.

The final production security advisor now reports only one warning: leaked-password protection is disabled. The prior authenticated-SECURITY-DEFINER warning for `process_referral_bonus` is cleared because the exposed `public.process_referral_bonus` is now an authenticated `SECURITY INVOKER` wrapper and the privileged implementation is in the non-exposed `private` schema. Production privilege verification confirmed anonymous execution is false for both functions and authenticated execution is limited to the intended wrapper/private call chain. A live RPC probe returned `No pending referral found for user.` for the signed-in user and `Unauthorized referee.` for a different user ID, confirming the wrapper does not permit cross-user bonus invocation.

## References

[1]: https://supabase.com/docs/guides/auth/server-side/advanced-guide "Supabase Auth SSR advanced guide"

[2]: https://docs.expo.dev/guides/using-supabase/ "Expo: Using Supabase"

[3]: https://supabase.com/docs/guides/auth/rate-limits "Supabase Auth rate limits"

[4]: https://supabase.com/docs/guides/auth/password-security "Supabase Auth password security"

[5]: https://supabase.com/docs/guides/auth/jwt-fields "Supabase JWT claims reference"
