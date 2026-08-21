# PadhAI App Blocking Platform Notes

## Android

Android AccessibilityService is user-enabled from system settings and receives accessibility events while running in the background. It can be declared through the Android manifest with BIND_ACCESSIBILITY_SERVICE and configured to receive window-state events. The service must be explicitly enabled by the user; PadhAI cannot silently enable it.

Google Play policy requires a declaration for apps using AccessibilityService that are not accessibility tools, plus prominent in-app disclosure and affirmative consent explaining the data accessed and how it is used. PadhAI must not claim to be an accessibility tool merely to obtain an exemption. A release using this approach requires policy review and a disclosure screen.

## iOS

iOS Family Controls can authorize parental-control behavior and use FamilyActivityPicker/ManagedSettings to shield applications, categories, and web domains. Apple requires the Family Controls capability and a distribution permission request before App Store submission. Without this entitlement, PadhAI can provide the timer and manual fallback but cannot guarantee OS-level app blocking.

## Expo

Expo config plugins can modify generated native Android and iOS projects during prebuild/CNG. A true cross-platform blocker therefore requires a custom native module/config plugin and a new development/preview build; it cannot be delivered as JavaScript-only code in an existing APK.

## Product rule confirmed by user

During Focus, PadhAI itself, Calls, Contacts, Google, and approved educational apps should remain available. YouTube should be blocked completely. If an unapproved app is opened, show a warning first; if the warning is ignored, pause the timer and mark the session broken. The same personal/group Focus timer flow should apply whether or not the user has joined a study group.

## References

1. Android AccessibilityService API: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
2. Google Play AccessibilityService policy: https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-GB
3. Apple Family Controls: https://developer.apple.com/documentation/familycontrols
4. Expo config plugin and native module tutorial: https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/

## Expo local module wiring

Expo Autolinking searches local modules under `./modules` by default when the package contains `expo-module.config.json` next to `package.json`. The local module must also be a dependency of the app. On SDK 53, Expo recommends disabling pnpm isolated dependencies for monorepo/native-module builds because isolated installations can cause native build and dependency-resolution errors. References: https://docs.expo.dev/modules/autolinking/ and https://docs.expo.dev/guides/monorepos/.
