# PadhAI Google OAuth Setup Guide

> **Goal:** Enable “Continue with Google” for PadhAI on Web, Android, and iOS using Supabase Auth.
>
> The app code is already prepared. This guide covers the dashboard configuration that cannot be safely stored in GitHub.

## 0. Important values for this project

| Item | Value / action |
|---|---|
| Supabase project | `Padh AI` |
| Supabase project reference | `sligrtvwosldwhlnfyen` |
| Supabase project URL | `https://sligrtvwosldwhlnfyen.supabase.co` |
| Public support email | `materialhubx@gmail.com` |
| Native app scheme | `PadhAI` |
| Native OAuth callback | `PadhAI://auth/callback` |
| Web OAuth callback | `https://YOUR_WEB_DOMAIN/auth/callback` |
| Supabase provider callback for Google Cloud | `https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback` |

The project currently has the `PadhAI` scheme in `app.json`. If you change the scheme, update the app configuration, Supabase redirect allowlist, and a new native build together.

## 1. Finalize Android and iOS identifiers first

Before creating native Google clients, set stable production identifiers in `app.json` or the EAS configuration. Do not create production OAuth clients with temporary identifiers.

Example format only:

```json
{
  "expo": {
    "android": { "package": "com.yourcompany.padhai" },
    "ios": { "bundleIdentifier": "com.yourcompany.padhai" }
  }
}
```

Use your real company/owner identifier instead of `com.yourcompany.padhai`. If the app already has published identifiers, keep those exact values.

## 2. Create or select the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select the Google Cloud project that should own PadhAI OAuth, or create a new project.
3. Open **Google Auth Platform**. If Google asks you to configure the consent screen, complete it before creating clients.
4. In **Branding**, set the application name to `PadhAI` and use `materialhubx@gmail.com` as the support/developer contact where Google asks for it.
5. Add the final public privacy-policy URL once the Web app is deployed. For local testing, the in-app policy is available at `/privacy-policy`, but Google production verification should use a stable HTTPS URL.
6. In **Audience**, choose the correct audience. Use **External** if users outside your Google Workspace will sign in. Keep the app in testing while configuring it, then complete verification if Google requires it for the intended audience.

## 3. Configure only the required Google scopes

In Google Auth Platform → **Data Access**, keep the authentication scopes minimal:

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

PadhAI does not need Gmail messages, Drive, Contacts, Calendar, or any other Google API access. Do not add those scopes.

## 4. Create the Web OAuth client

1. Open Google Auth Platform → **Clients** → **Create client**.
2. Choose **Web application**.
3. Give it a clear name such as `PadhAI Web`.
4. Under **Authorized JavaScript origins**, add each origin where the Web app actually runs:

```text
https://YOUR_WEB_DOMAIN
http://localhost:8081
http://localhost:4178
```

Use only the ports you actually use. If you access the local app through `127.0.0.1`, add that exact origin too, for example `http://127.0.0.1:8081`.

5. Under **Authorized redirect URIs**, add the Supabase Auth callback exactly:

```text
https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback
```

This Google redirect URI is **not** `PadhAI://auth/callback`. Google first redirects to Supabase; Supabase then redirects to the app callback.

6. Click **Create**.
7. Copy the Web **Client ID** and **Client Secret** temporarily to a secure password manager. The Client ID is public-ish; the Client Secret is private. Never put the secret in the Expo app, `.env`, GitHub, or screenshots.

## 5. Create the Android OAuth client

1. In Google Auth Platform → **Clients**, create another client of type **Android**.
2. Enter the final Android package name from `app.json`.
3. Add the SHA-1 certificate fingerprint for the build that will be used.
4. Add both development and production fingerprints if both builds need Google login. Debug, EAS development, preview, and Play Store/release certificates can have different fingerprints.
5. Save the Android Client ID.

For EAS builds, retrieve the relevant credentials/fingerprints through the EAS credentials workflow or the Google Play/App signing configuration. Do not assume that a local debug SHA-1 is the same as the production Play signing SHA-1.

## 6. Create the iOS OAuth client

1. In Google Auth Platform → **Clients**, create another client of type **iOS**.
2. Enter the final iOS bundle identifier from `app.json`.
3. If Google requests App Store ID or Team ID, provide them when the app is published; otherwise complete the fields required for the current development stage.
4. Save the iOS Client ID.

The iOS bundle identifier in Google must exactly match the identifier embedded in the development/release build.

## 7. Enable Google in Supabase

1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/sligrtvwosldwhlnfyen/auth/providers).
2. Go to **Authentication → Providers → Google**.
3. Turn **Google enabled** on.
4. In **Client IDs**, enter the IDs with the **Web Client ID first**, followed by Android and iOS IDs separated by commas:

```text
WEB_CLIENT_ID,ANDROID_CLIENT_ID,IOS_CLIENT_ID
```

5. Paste the **Web Client Secret** into the Google provider’s Client Secret field.
6. Save the provider configuration.

Only the Web Client Secret belongs in Supabase. Do not paste it into `app.json`, `AuthScreen.tsx`, `.env`, or any source file.

## 8. Configure Supabase redirect URLs

1. In Supabase Dashboard, go to **Authentication → URL Configuration**.
2. Set **Site URL** to the real production Web origin, for example:

```text
https://YOUR_WEB_DOMAIN
```

3. Under **Additional Redirect URLs**, add the native callback:

```text
PadhAI://auth/callback
```

4. Add the production Web callback:

```text
https://YOUR_WEB_DOMAIN/auth/callback
```

5. Add the exact local Web callbacks used during development. For example:

```text
http://localhost:8081/auth/callback
http://localhost:4178/auth/callback
http://127.0.0.1:8081/auth/callback
```

Do not add broad wildcards or unrelated domains to the production allowlist. The redirect URL must match exactly, including scheme, hostname, port, and path.

## 9. Test the Web flow

1. Start the Expo Web development server.
2. Open `/login`.
3. Click **Continue with Google**.
4. Complete Google consent.
5. Confirm that the browser returns to `/auth/callback` and then to the PadhAI home screen.
6. Confirm that a first-time Google user gets a `public.users` row and that the profile name/email/avatar appear correctly.
7. Sign out and sign in again with Google to verify session persistence.

## 10. Test Android and iOS

Use an Expo development build or standalone build that contains the `PadhAI` scheme. A plain browser test does not validate native deep-link registration.

For each platform:

1. Install the build with the same package/bundle identifier and signing certificate configured in Google Cloud.
2. Open the login screen and press **Continue with Google**.
3. Complete the browser authentication.
4. Confirm that the browser returns to `PadhAI://auth/callback`.
5. Confirm that the app returns to `/(tabs)` with a valid Supabase session.
6. Sign out and repeat the login.

## 11. Common errors and fixes

| Error | Likely cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | Google Authorized redirect URI is wrong | Add the Supabase callback `https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback` to the Web client. |
| Supabase says provider is not enabled | Google provider is off or unsaved | Enable Google under Supabase Authentication → Providers → Google and save. |
| `Invalid client` on Android | Package name or SHA-1 does not match the build | Check the actual build certificate and add its SHA-1 to the Android client. |
| iOS sign-in does not return to the app | Bundle ID or custom scheme is inconsistent | Verify the iOS bundle ID and the `PadhAI` app scheme, then rebuild. |
| Web returns to a 404 | Web origin/callback is not in Supabase allowlist or host lacks SPA/static rewrites | Add the exact Web callback and configure the hosting platform to serve Expo Router routes. |
| Login works but profile row is missing | Auth trigger or database insert error | Inspect Supabase Auth/Postgres logs and verify the `handle_new_user` trigger. |
| Google asks for too many permissions | Extra Google API scopes were added | Remove all scopes except `openid`, email, and profile. |

## 12. Security checklist before production

- Keep the Google Web Client Secret only in Supabase Dashboard or a secret manager.
- Never commit service-role keys, Google secrets, private keys, or OAuth credential JSON files.
- Keep Google scopes limited to `openid`, email, and profile.
- Keep Supabase Additional Redirect URLs limited to domains and schemes controlled by PadhAI.
- Publish the final Privacy Policy URL and update the editable owner/company, effective-date, retention, and deletion wording in `constants/privacyPolicy.ts`.
- Complete Google branding/verification requirements if the app is released to external users.

## Official references

[1]: https://supabase.com/docs/guides/auth/social-login/auth-google "Supabase Login with Google"
[2]: https://supabase.com/docs/guides/auth/native-mobile-deep-linking "Supabase Native Mobile Deep Linking"
[3]: https://supabase.com/docs/guides/auth/redirect-urls "Supabase Redirect URLs"
[4]: https://developers.google.com/identity/protocols/oauth2 "Google OAuth 2.0"
[5]: https://docs.expo.dev/guides/using-supabase/ "Expo Using Supabase"
