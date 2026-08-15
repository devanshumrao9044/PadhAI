# Google OAuth research notes

## Official sources

1. [Supabase Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
2. [Supabase Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
3. [Expo Using Supabase](https://docs.expo.dev/guides/using-supabase/)

## Findings

Supabase's Expo React Native guidance uses a custom application URL scheme, `makeRedirectUri()`, `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`, `WebBrowser.openAuthSessionAsync()`, and session creation from the callback URL. The browser-only flow should allow the normal browser redirect on Web, while Android/iOS use the application callback scheme.

The app already declares the `PadhAI` scheme in `app.json`. Supabase Auth URL Configuration must include the mobile callback scheme and the production web origin. The Google provider requires Google Cloud OAuth configuration and provider settings in Supabase; client secrets must stay in the Supabase Dashboard and never enter the repository.

The existing client persists sessions through AsyncStorage on native and localStorage on Web. The existing auth-state listener can consume the session established by the OAuth callback, so the OAuth method should return to the existing `/(tabs)` route rather than create a second auth state system.

The Google provider needs profile scopes (`openid`, email, profile) only. The app will not request Google API access beyond authentication. Privacy-policy text should disclose Google authentication, Supabase hosting/authentication, profile and study data stored by PadhAI, avatar storage, referrals, analytics/study metrics, account deletion/contact process, and the editable owner/company details.
