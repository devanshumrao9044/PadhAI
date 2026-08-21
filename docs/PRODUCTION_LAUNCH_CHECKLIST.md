# PadhAI Production Launch Checklist

**Status date:** 21 August 2026
**Release target:** Android APK for direct device testing and Android App Bundle (AAB) for a future Google Play release
**Owner:** Devansh

## Executive status

PadhAI is **ready for authenticated internal APK distribution**. The repository is on the restored original purple/blue palette, the production Supabase project is healthy, the latest migration is applied, and the automated checks pass. The Expo project is now linked under `@devansh9044/PadhAI`, and the successful EAS preview build produced an installable Android APK.

The preview profile explicitly requests an Android APK. The production profile remains suitable for a store-oriented AAB because EAS recommends APK for internal preview distribution and AAB for Google Play distribution [1] [4]. No credential, service-role key, database password, signing keystore, or Expo token is stored in the repository.

| Area | Current status | Launch interpretation |
| --- | --- | --- |
| Application code | Ready for preview | Core authentication, onboarding, Focus, offline Focus sync, tracker, analytics, leaderboard, groups, notifications, settings, bilingual UI, privacy policy, and support flows are present. |
| Production Supabase | Healthy | Project `sligrtvwosldwhlnfyen`, region `ap-south-1`, PostgreSQL 17.6.1, status `ACTIVE_HEALTHY`. |
| Database migrations | Applied | 41 migrations are present in production; the latest is `offline_focus_sync` (`20260821092434`). |
| Security advisor | One explicitly excluded warning | The only warning is leaked-password protection. It remains unchanged because the product requirement explicitly excludes that setting. |
| Performance advisor | Informational notices only | 21 unused-index notices are safe to leave in place for a new app; removing them before real usage would be premature. |
| Automated verification | Passing | 62/62 tests pass, TypeScript is clean, Expo lint is clean, and web export completes across 41 routes. |
| Android preview artifact | Built and verified | EAS build `d607603a-03a5-4f9f-87de-2189ac5a784f` finished successfully and produced `PadhAI-preview-1.0.0.apk`. |
| Play Store release | Not yet submitted | A Google Play developer account, signing credentials, store listing assets, and a public privacy-policy URL are still required. |

## What from `AppLaunchGuide.docx` applies

The supplied document is primarily a Next.js web-launch guide. Its Open Graph metadata, sitemap, robots file, and subdomain instructions are **not required for the native Expo Android app**. PadhAI already has an in-app privacy-policy screen and an onboarding flow, so those are the relevant mobile-launch items from the guide.

The optional onboarding checklist described by the guide is not a release blocker. The current onboarding flow is already present and validated; a persistent five-step checklist can be added later as a product enhancement without delaying the first authenticated preview build. External analytics such as PostHog are also optional and are not necessary for a ₹0 launch because the app already records its core study and Focus metrics internally.

## Repository release configuration

The app identity is currently `PadhAI`, package name `com.padhai.app`, URL scheme `PadhAI`, and version `1.0.0`. The original purple/blue runtime palette is retained. The splash-screen configuration has separate light and dark assets, and the notification config plugin is present in `app.json`.

`eas.json` intentionally has two release paths:

| Profile | Intended use | Output |
| --- | --- | --- |
| `preview` | Free internal testing on Android devices or emulators | Explicit Android `.apk`; `distribution` is `internal`. |
| `production` | Store-oriented release preparation | Android `.aab` by default with remote version auto-increment. |

The explicit APK setting is important because an AAB cannot be installed directly on a device; Expo’s official guidance says an APK profile should use an internal distribution or an explicit Android APK build type [1].

## EAS account and APK build

EAS Build requires an Expo account, even on the free plan [2]. The account was authenticated without placing credentials in source control, and the project was linked as `@devansh9044/PadhAI` with non-secret project ID `dc9a9d86-2535-4c4a-ae52-413d43ab17ce`. The first build exposed a pnpm/Expo SDK 53 autolinking issue; it was fixed by adding the exact `expo-modules-autolinking@2.1.12` dev dependency and retaining the selective workspace hoist. The fourth build completed successfully.

Use one of these two equivalent paths:

| Path | User action | What happens next |
| --- | --- | --- |
| Browser login | Sign in at <https://expo.dev/login>, then tell the agent that login is complete | The agent can run the non-interactive preview build command from the repository. |
| Token login | Create an Expo access token in the Expo account settings and provide it only as an environment variable for the build session | The agent can authenticate EAS without storing the token in source control. |

After authentication, the project should be linked with `eas init` if it has not already been linked. That command creates the EAS project UUID and writes `extra.eas.projectId` into the app configuration [3]. The generated UUID is not a secret. The Expo push-token service uses the project ID to attribute tokens to the correct project, and the current notification service already reads it from app configuration or the optional `EXPO_PUBLIC_EAS_PROJECT_ID` environment variable [3].

The reproducible preview build command is:

```bash
cd /home/ubuntu/PadhAI
CI=1 pnpm --config.ignore-scripts=true dlx --package eas-cli@latest eas build --platform android --profile preview --non-interactive
```

The successful build details page is <https://expo.dev/accounts/devansh9044/projects/PadhAI/builds/d607603a-03a5-4f9f-87de-2189ac5a784f>, and the direct APK URL is <https://expo.dev/artifacts/eas/55aAR1_agMq3yuzWA97YSZmrWB_OfhAsjGJSm5Qkw9k.apk>. The APK was downloaded locally and verified as an Android package; its SHA-256 is `4e9af8d4f7fbd8aa77a6b377ec4d7bf6695a71bd710955afd61b7e60dbfb4785`. The APK can be installed directly on a physical Android device or emulator [1].

## Push-notification launch dependency

Local notifications do not require an Expo project ID. Remote push notifications do: the app needs notification permission, an Expo push token, and Android FCM credentials configured for the EAS project [3]. The app already requests permission, stores device tokens in the protected `notification_devices` table, and uses the owner/admin notification path. After the first linked EAS build, test one device notification before enabling broad production messaging.

A practical free test is:

1. Install the preview APK on a physical Android device.
2. Sign in and enable notifications in Settings.
3. Confirm that the device registers an Expo push token.
4. Send one test notification through the Expo notification tester or the app’s owner/admin flow.
5. Confirm the notification appears while the app is backgrounded and that opening it routes to the intended in-app notification screen.

The official Expo setup requires device permission and an `ExpoPushToken`, and recommends using the project ID from `extra.eas.projectId` when requesting the token [3].

## Supabase launch checks

The production project is `ACTIVE_HEALTHY`. All 41 migrations are applied, including email confirmation enforcement, referral validation, subject deletion, chapter synchronization, notification authorization, study-group permissions, and offline Focus synchronization. The leaked-password advisory remains deliberately excluded, in accordance with the product requirement.

The performance advisor currently reports 21 **INFO-level** unused-index notices. These notices do not indicate broken queries or missing security policies. They should be monitored after real usage rather than removed now; premature index deletion could make normal user queries slower later.

Before the first public release, run one bounded production smoke test with a real test account: create a subject and chapter, complete a Focus session, verify the session and chapter analytics, delete the subject, confirm the tracker and analytics no longer show its chapter, and verify that an offline Focus session syncs exactly once after reconnection. Do not use fake production data or a service-role key in the mobile client.

## Store-release requirements that are not free

Direct APK distribution and internal testing can be performed without a Play Store membership. Publishing to Google Play is a separate step and requires a Google Play developer membership; Expo’s current build guide documents a one-time USD 25 membership requirement [2]. Therefore, under the ₹0 budget, the realistic immediate launch is a signed preview APK shared directly with testers. A Play Store launch can follow when the account and store fees are available.

For a later Play Store submission, prepare the following without changing the app’s core behavior:

| Requirement | Current state | Needed later |
| --- | --- | --- |
| AAB | Profile is present | Run the `production` build after the preview APK is accepted. |
| Signing | Managed by EAS when authenticated | Generate or select the Android keystore through EAS; never commit it. |
| App icon | Existing logo asset is configured | Produce final store-quality icon variants and confirm adaptive-icon safe areas. |
| Feature graphic | Not verified in this repository | Create the Play Store feature graphic. |
| Screenshots | Not verified in this repository | Capture current production-like screens in supported Android dimensions. |
| Description | Not finalized | Write short and full descriptions in the approved English/Hindi product voice. |
| Privacy policy URL | In-app screen exists | Host a public, stable privacy-policy URL required by the Play listing. |
| Data-safety answers | Not submitted | Complete Play Console’s data-safety form from the actual Supabase and notification behavior. |

## Final go/no-go criteria

The app is **go for authenticated internal APK distribution**. It is **not yet go for Play Store publication** until the public privacy URL, store assets, data-safety declaration, and physical-device smoke test are complete.

The first release should not include unrelated palette changes, password-protection changes, a risky auth-storage rewrite, deletion of informational indexes, or unverified UI experiments. The native Expo client intentionally retains its current storage architecture; an HttpOnly-cookie migration would require a separate server-side web/BFF runtime and is not a safe one-file change for this app [5].

## References

[1]: <https://docs.expo.dev/build-reference/apk/> "Expo: Build APKs for Android Emulators and devices"
[2]: <https://docs.expo.dev/build/setup/> "Expo: Create your first build"
[3]: <https://docs.expo.dev/push-notifications/push-notifications-setup/> "Expo: Push notifications setup"
[4]: <https://docs.expo.dev/build/eas-json/> "Expo: Configure EAS Build with eas.json"
[5]: <https://supabase.com/docs/guides/auth/server-side/overview> "Supabase: Auth server-side overview"

> **Important:** The preview APK has been produced successfully. The downloaded APK is attached with the release report; the generated signing credentials remain managed by EAS and are not stored in this repository.

This checklist is intentionally operational: it records the current state and the exact boundary between changes that can be made in code and steps that require the account owner’s external credentials or store accounts.

## Change log

| Date | Change |
| --- | --- |
| 21 August 2026 | Added an explicit Android APK build type to the `preview` EAS profile and recorded the production launch status. |
| 21 August 2026 | Confirmed 41 production migrations, healthy Supabase status, the excluded leaked-password warning, and informational unused-index notices. |
| 21 August 2026 | Linked `@devansh9044/PadhAI`, fixed the Expo SDK 53 + pnpm autolinking failure, completed EAS build `d607603a-03a5-4f9f-87de-2189ac5a784f`, and verified the 80 MB APK checksum. |

> **Note:** The five offline Focus design documents under `docs/` remain intentionally untracked. They are not part of this launch configuration change.

## Verification commands

Run these commands from the repository before pushing a release change:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec expo lint
pnpm exec expo export --platform web --output-dir web-export-check
rm -rf web-export-check
```

Also verify the release JSON parses cleanly:

```bash
node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8')); JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('release JSON ok')"
```

The generated APK and AAB are build artifacts, not source files, and must not be committed to Git.

## References to repository files

- `app.json` — app identity, splash, icon, deep link scheme, and notification plugin.
- `eas.json` — preview APK and production AAB build profiles.
- `.env.example` — public Supabase configuration and optional non-secret EAS project ID.
- `features/notifications/services/adminNotifications.ts` — notification-device registration and owner/admin notification service.
- `README.md` — setup, verification, Supabase security conventions, and current auth-storage limitation.
- `supabase/migrations/` — timestamped database migrations applied to production.
