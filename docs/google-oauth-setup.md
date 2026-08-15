# Google OAuth setup for PadhAI

The app code now supports **Continue with Google** on Web, Android, and iOS through Supabase Auth. The provider still needs to be enabled in Google Cloud and Supabase because OAuth client secrets cannot be safely created or stored in the mobile app repository.

> This is an implementation checklist. Replace the bracketed values with the real production values before publishing.

## 1. Google Cloud / Google Auth Platform

Create or select the Google Cloud project for PadhAI. In Google Auth Platform, configure the consent screen with the app name `PadhAI`, public support email `materialhubx@gmail.com`, developer contact `materialhubx@gmail.com`, and only these basic scopes:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

Do not request Gmail, Drive, Contacts, Calendar, or other Google API scopes. Add the final public privacy-policy URL when the Web build is deployed.

Create the following OAuth clients as required by the platforms being shipped:

| Client | Required Google configuration |
|---|---|
| Web | Authorized JavaScript origins: the production Web origin and local development origin. Authorized redirect URI: `https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback`. |
| Android | The final Android package name and SHA-1 certificate fingerprints for development and production signing. |
| iOS | The final iOS bundle identifier. |

The Android package name and iOS bundle identifier must be finalized in `app.json`/EAS before creating the native Google clients. Do not use temporary identifiers in the production credentials.

## 2. Supabase Dashboard

Open **Authentication → Providers → Google** for project `sligrtvwosldwhlnfyen`. Enable Google and add the Google Web Client ID first, followed by the Android and iOS client IDs separated by commas if those clients are created. Store the Google Client Secret only in the Supabase Dashboard.

Under **Authentication → URL Configuration → Additional Redirect URLs**, add:

```text
PadhAI://auth/callback
```

Also add the deployed Web callback URL:

```text
https://[your-web-domain]/auth/callback
```

For local Web testing, add the actual Expo Web origin, for example `http://localhost:8081/auth/callback` or the port shown by the development server. Keep the redirect allowlist limited to URLs you control.

## 3. App behavior

The app uses the existing `PadhAI` custom scheme for native callbacks and `/auth/callback` for Web. The callback establishes the Supabase session and returns the user to `/(tabs)`. Existing email/password sign-in, signup, password reset, logout, and route-guard behavior remain separate and unchanged.

The editable policy content is in `constants/privacyPolicy.ts`. Update the owner label, effective date, retention wording, and any jurisdiction-specific language before public release. The in-app policy route is `/privacy-policy`, and it is linked from both the auth screen and Profile → Account Info.

## 4. Required security rules

Never put the Google Client Secret, Supabase service-role key, or any private credential in `.env` variables exposed to Expo, source files, or GitHub. The app may contain only the public Supabase URL and publishable/anon key. Configure secrets in Supabase and Google Cloud dashboards.
