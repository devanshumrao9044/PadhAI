# Legacy authentication archive

The files in this directory are retained for reference only and are not imported by the active Expo Router tree.

The active authentication implementation is under `/auth`:

- `auth/AuthSessionProvider.tsx` owns Supabase session hydration, sign-in, sign-up, password reset, and sign-out.
- `auth/AuthScreen.tsx` is the only active login route implementation.
- `auth/AuthRouteGuard.tsx` owns protected-route redirects and authenticated root routing.

Do not add new login/logout navigation logic to the archived files. Changes should be made in `/auth` so the app has one session owner and one route guard.
