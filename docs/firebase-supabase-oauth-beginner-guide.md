# PadhAI Google Login: Beginner Phase-by-Phase Guide

## What we are building

The final setup is:

```text
Google identity verification
        ↓
Supabase Auth session
        ↓
Supabase Postgres: users, subjects, chapters, XP, analytics, referrals
```

Firebase will not be used for Firestore, Realtime Database, Storage, or Firebase Auth in the app. It is only the project/credential layer for the Google OAuth clients.

## Phase 0 — Do not change the code

The repository is already prepared. Do not install Firebase SDK, do not create a Firebase database, and do not replace Supabase Auth. The app already contains the Google button, callback route, and Privacy Policy.

The repository uses the Supabase project reference `sligrtvwosldwhlnfyen`. The native callback is:

```text
PadhAI://auth/callback
```

The Supabase callback that Google must call is:

```text
https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback
```

## Phase 1 — Create/select the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a project** or select an existing project.
3. Use a clear name such as `PadhAI OAuth`.
4. Google Analytics is not required for this login setup; you may leave it disabled if Firebase allows that option.
5. Finish project creation.
6. Open **Project settings → General** and note the Firebase project name and project ID.

Do not create Firestore, Realtime Database, Storage, or Firebase app authentication for this architecture.

## Phase 2 — Prepare app identifiers

Before creating Android/iOS OAuth clients, decide the final identifiers:

| Platform | Value you need |
|---|---|
| Android | Final package name, for example `com.example.padhai` |
| Android | SHA-1 fingerprint for the development/release build |
| iOS | Final bundle identifier, for example `com.example.padhai` |
| Web | Final HTTPS website origin, for example `https://padhai.example.com` |

Do not use temporary package names for production. The identifiers in Google/Firebase must match the actual app build exactly.

## Phase 3 — Configure Google consent/branding

1. In Firebase, open the project settings or the linked Google project configuration.
2. Open **Google Auth Platform → Branding** if Google shows that section.
3. App name: `PadhAI`.
4. Support/developer email: `materialhubx@gmail.com`.
5. Add the final public HTTPS Privacy Policy URL when the Web site is deployed.
6. Keep the requested scopes limited to:

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

Do not request Gmail messages, Drive, Contacts, Calendar, or other Google API permissions.

## Phase 4 — Create the Web OAuth client

1. Open the linked Google credentials page from the Firebase project, or open **Google Auth Platform → Clients**.
2. Click **Create client**.
3. Select **Web application**.
4. Add your Web origins under **Authorized JavaScript origins**:

```text
https://YOUR_WEB_DOMAIN
http://localhost:8081
```

Add the local port that your Expo Web server actually uses. Add `http://127.0.0.1:PORT` too only if you use that address.

5. Under **Authorized redirect URIs**, add exactly:

```text
https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback
```

This is the Google-to-Supabase callback. Do not put `PadhAI://auth/callback` in this Google Web redirect field.

6. Click **Create**.
7. Copy the Web **Client ID**.
8. Copy the Web **Client Secret** only to a password manager temporarily. Do not put it into GitHub, source code, `.env`, or this repository.

## Phase 5 — Create the Android OAuth client

1. In Google Auth Platform → **Clients**, click **Create client**.
2. Select **Android**.
3. Enter the final Android package name.
4. Enter the SHA-1 fingerprint for the build you will test.
5. If development and production builds have different certificates, add/create credentials for both fingerprints.
6. Save the Android Client ID.

The Android Client ID is later added to Supabase. Firebase/Google still verifies the Android package and certificate.

## Phase 6 — Create the iOS OAuth client

1. In Google Auth Platform → **Clients**, click **Create client**.
2. Select **iOS**.
3. Enter the final iOS bundle identifier.
4. Enter App Store ID/Team ID only when Google asks for them and they are available.
5. Save the iOS Client ID.

## Phase 7 — Enable Google in Supabase

1. Open the [PadhAI Supabase Google provider page](https://supabase.com/dashboard/project/sligrtvwosldwhlnfyen/auth/providers?provider=Google).
2. Go to **Authentication → Providers → Google**.
3. Turn Google **ON**.
4. In the **Client IDs** field, enter the IDs in this order, separated by commas:

```text
WEB_CLIENT_ID,ANDROID_CLIENT_ID,IOS_CLIENT_ID
```

5. Paste the **Web Client Secret** into the Google provider's Client Secret field.
6. Save.

The secret belongs in Supabase Dashboard only. It does not belong in the mobile app.

## Phase 8 — Add Supabase redirect URLs

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to the production Web origin:

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

5. Add the exact local Web callback used by Expo, for example:

```text
http://localhost:8081/auth/callback
http://127.0.0.1:8081/auth/callback
```

Do not add broad wildcards or unknown domains.

## Phase 9 — Test Web first

1. Start the Expo Web app.
2. Open `/login`.
3. Click **Continue with Google**.
4. Complete Google login.
5. Confirm the browser returns to `/auth/callback` and then to the PadhAI home screen.
6. Confirm the user appears in Supabase Authentication → Users.
7. Confirm the matching profile appears in the Supabase `public.users` table.
8. Confirm the user's name, email, avatar, and study data are loaded by PadhAI.

## Phase 10 — Test Android and iOS

Use an Expo development build or standalone build containing the `PadhAI` scheme. A normal browser test does not validate native deep linking.

For each platform, press **Continue with Google**, complete login, and confirm that the browser returns to `PadhAI://auth/callback` and the app opens the existing `/(tabs)` home screen.

## Phase 11 — Security and cleanup

Never store these in GitHub or the project folder:

- Supabase Dashboard password.
- Google Web Client Secret.
- Supabase service-role key.
- Firebase Admin SDK private key.
- OAuth credential JSON files containing private keys.

Use a password manager for the Supabase login and Web Client Secret. The repository contains only a safe placeholder template at `docs/oauth-credentials.template.txt`.

## Common errors

| Error | Meaning | Fix |
|---|---|---|
| `redirect_uri_mismatch` | Google does not have the Supabase callback | Add `https://sligrtvwosldwhlnfyen.supabase.co/auth/v1/callback` to the Web client's Authorized redirect URIs. |
| Provider disabled | Supabase Google provider is off | Enable and save Google under Supabase Authentication → Providers. |
| Android invalid client | Package name/SHA-1 mismatch | Check the actual build's package and signing fingerprint. |
| Web 404 after login | Redirect not allowlisted or hosting rewrite missing | Add the exact `/auth/callback` URL in Supabase and configure the Web host's SPA/static rewrite. |
| User authenticates but profile fails | Trigger/data issue | Check Supabase Auth/Postgres logs and the `handle_new_user` trigger. |

## Official references

[1]: https://supabase.com/docs/guides/auth/social-login/auth-google "Supabase Google Login"
[2]: https://supabase.com/docs/guides/auth/native-mobile-deep-linking "Supabase Native Mobile Deep Linking"
[3]: https://supabase.com/docs/guides/auth/redirect-urls "Supabase Redirect URLs"
[4]: https://firebase.google.com/docs/auth/web/google-signin "Firebase Google Sign-In"
[5]: https://firebase.google.com/docs/auth/android/google-signin "Firebase Android Google Sign-In"
