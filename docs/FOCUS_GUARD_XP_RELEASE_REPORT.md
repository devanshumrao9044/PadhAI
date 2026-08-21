# PadhAI Focus Guard and General Study XP Release Report

**Release commit:** `16dc640` on GitHub `main`
**Android build:** EAS build `0a4b530e-04d4-4a2f-a2a4-04ff3e54d489`
**App package:** `com.padhai.app`
**App version:** `1.0.0`

## Release result

The launch-crash hardening, General Study session persistence, and Focus Guard changes were implemented and pushed to GitHub `main`. A new Android preview APK compiled successfully on EAS. The APK contains the compiled `PadhAIFocusGuard` native bridge and passes ZIP/package integrity validation.

The launch fix keeps the original purple/blue palette and existing password-protection decision unchanged. It includes the lower-case deep-link scheme, the missing Expo font peer dependency, and guarded notification/splash startup initialization. These changes are intended to prevent the immediate standalone-app force-close that previously displayed the clear-cache/force-stop message.

## General Study XP fix

A Focus session without a subject, chapter, or topic is now treated as **General Study** rather than being lost during hydration. The completed session and XP transaction are retained locally, merged with cloud results by session/transaction ID, and written back to the device cache until Supabase reflects them. A 120-minute completed session calculates `240 XP` under the existing ten-XP-per-five-minutes rule, with the existing comeback bonus applied only when eligible. The same session can therefore contribute to history, streak credit, analytics, and offline sync without requiring a tracker link.

New regression coverage verifies the General Study label, 120-minute XP calculation, duplicate-safe local/cloud session merging, and XP transaction retention.

## Focus Guard behavior

On Android, starting Focus starts the native Focus Guard when the user has granted both required permissions: overlay display permission and usage-access permission. YouTube is in the default blocked set. PadhAI, Calls, Contacts, Google, and the default approved educational-app list remain allowed. The allowlist is stored locally on the device; installed-app data is not sent to Supabase.

When an unapproved app is opened during Focus, the native service displays a warning overlay. If the user returns to PadhAI within the grace period, the session continues. If the warning is ignored for the grace period, the service records a break request; when PadhAI resumes, it pauses the timer and marks the session broken through the existing Focus flow. The same behavior is used for personal sessions and sessions that have a `studyGroupId`; group presence is an additional live-status layer and does not change the Focus accounting rules.

The Android native service is an Expo local module under `modules/padhai-focus-guard/`. It is autolinked from the app’s local `modules` directory and compiled into the EAS APK. The feature requires a new native build; it is not available in the old APK or Expo Go.

## iPhone behavior

The current iPhone implementation intentionally uses an honest fallback: the Focus timer can run in the background, but guaranteed OS-level app blocking is not claimed without Apple Family Controls authorization. Apple requires the Family Controls capability and distribution permission before an App Store submission can use the Screen Time APIs [3]. The current build does not fake that authorization.

## Verification

| Check | Result |
|---|---|
| Automated tests | 65 passed, 0 failed |
| TypeScript | Passed |
| Expo lint | Passed |
| Expo web export | Passed; 41 HTML routes generated |
| EAS Android preview build | Finished successfully |
| APK package integrity | Passed |
| Compiled native bridge symbol | `PadhAIFocusGuard` present in DEX |
| GitHub push | `16dc640` pushed to `main` |

## Required manual checks on the device

On Android, install the attached APK, open Focus, grant overlay permission and usage access, start a short test session, open YouTube, confirm the warning appears, remain there beyond the grace period, and return to PadhAI to verify that the session is paused/broken. Then repeat inside a group session to verify that the member presence changes independently of XP and session accounting.

Also test the 120-minute or a short equivalent General Study session without selecting a subject. The completion screen should show XP, and after reopening the app the session should remain in History instead of disappearing during hydration.

Before Play Store submission, complete Google Play’s AccessibilityService disclosure/declaration requirements. Android’s AccessibilityService is explicitly user-enabled through system settings, and Google Play requires prominent in-app disclosure and affirmative consent for non-accessibility-tool uses [1] [2]. The iPhone OS-level blocker remains a separate Apple entitlement and distribution-approval task.

## Logo note

No logo asset was changed in this release because “logo/person” did not identify whether the problem is cropping, resolution, color, splash sizing, or the in-app profile image. A screenshot or a precise location is still needed before changing the existing branding asset.

## References

[1]: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService "Android AccessibilityService API reference"

[2]: https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-GB "Google Play: Use of the AccessibilityService API"

[3]: https://developer.apple.com/documentation/familycontrols "Apple Family Controls documentation"

[4]: https://docs.expo.dev/modules/autolinking/ "Expo Autolinking documentation"
