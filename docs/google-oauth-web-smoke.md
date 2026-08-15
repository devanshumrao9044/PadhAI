# Google OAuth Web smoke findings

The Expo Web export completed successfully and generated `auth/callback.html` and `privacy-policy.html`.

A raw Python static server returned the app's not-found screen for `/privacy-policy.html` and a server 404 for `/privacy-policy`. This is a static-host rewrite/route-serving limitation of the test server, not a TypeScript or Expo export failure. Production hosting must serve Expo static routes with the platform's rewrite/fallback rules, or expose the generated `.html` route appropriately.

The Expo Web development server was then opened at `http://127.0.0.1:4178`. The `/privacy-policy` route rendered the full policy, effective date, and `materialhubx@gmail.com` contact. The `/login` route rendered the existing email login form, `Continue with Google`, and `Privacy Policy` link with no visible runtime error.
