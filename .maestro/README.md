# PadhAI Maestro E2E tests

The `leaderboard-rank-transition.yaml` flow covers the authenticated mobile path from a clean app state through login, live leaderboard loading, first top-three observation, celebration animation, animation dismissal, and a relaunch that must not replay the celebration.

## What the flow verifies

The flow uses the real Supabase leaderboard RPC. `clearState: true` removes the local user-and-level celebration marker, so an account currently ranked in the top three is treated as newly entering the top-three experience. It then asserts the live leaderboard, the `Top 3 achievement!` banner, the achieved rank, the banner dismissal, and the absence of a replay after relaunch.

For a deterministic rank-4-to-rank-1 promotion test, use a dedicated staging Supabase project or a resettable fixture account whose live leaderboard rank is controlled before the run. Do not mutate production leaderboard data from an E2E flow.

## Prerequisites

A native Android or iOS build must be installed on the device. The app identifiers are `com.padhai.app` for Android and iOS. Maestro must be installed separately and the device must be visible to Maestro. Android runs require an Android device/emulator and ADB; iOS runs require macOS, Xcode, and a simulator or connected device.

Build the app with the staging Supabase URL and anon key injected through Expo environment variables. Do not put credentials in this directory or in source control.

## Run

Pass the test account and expected current rank through the wrapper:

```bash
export PADHAI_E2E_EMAIL="e2e-user@example.com"
export PADHAI_E2E_PASSWORD="<secret-store-value>"
export PADHAI_E2E_EXPECTED_RANK="1"
pnpm e2e:maestro
```

The wrapper maps these values to `MAESTRO_*` environment variables, which the flow reads at runtime. The password is supplied only through the shell/CI secret store and is not passed as a Maestro command-line argument. The flow intentionally contains no account credentials.

## CI guidance

Use a dedicated staging project, a disposable confirmed test account, and a resettable leaderboard fixture. Store `PADHAI_E2E_EMAIL` and `PADHAI_E2E_PASSWORD` as encrypted CI secrets. Keep `PADHAI_E2E_EXPECTED_RANK` as a non-secret environment value that matches the fixture. Run the flow on at least one Android low-end profile and one iOS simulator before release.
