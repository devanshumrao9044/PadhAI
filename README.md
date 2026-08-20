# PadhAI

> **A focused study companion for planning, deep-work sessions, progress tracking, and exam preparation.**

PadhAI is a React Native application built with **Expo Router**, **TypeScript**, and **Supabase**. It supports study-goal onboarding, subject and chapter tracking, focus sessions, XP and weekly progression, level-wise leaderboards, referrals, notifications, analytics, calendar planning, and bilingual English/Hindi experiences.

The repository is organized so that **Expo Router screen paths remain stable**, while reusable domain code lives under feature folders. This avoids the common mistake of moving route files into arbitrary folders and silently breaking navigation.

## Technology

| Layer | Technology |
|---|---|
| Mobile and web client | React Native 0.79, Expo SDK 53, Expo Router v5 |
| Language | TypeScript with strict checking |
| Backend | Supabase Auth, PostgreSQL, RLS, RPCs, Realtime, Storage, Edge Functions |
| Local persistence | AsyncStorage, compressed cache payloads, platform-aware storage adapters |
| Testing | Node test runner with `--experimental-strip-types` |
| Package manager | pnpm |
| Supported targets | Android, iOS, and static web export |

## Repository structure

```text
PadhAI/
├── app/                              # Expo Router routes; keep route paths stable
│   ├── (tabs)/                       # Home, focus, tracker, analytics, profile, leaderboard
│   ├── admin/                        # Admin notification route
│   ├── focus/                        # Active, completion, recovery, and level-up routes
│   ├── tracker/                      # Subject and chapter detail routes
│   ├── _layout.tsx                   # Root providers, notification setup, route shell
│   └── ...                           # Standalone routes such as login, onboarding, calendar
├── auth/                             # Active authentication screens, provider, guard, policy
├── components/                       # Reusable presentation components
│   ├── auth/                         # Legacy reusable auth widgets kept separate from active auth
│   ├── dashboard/                    # Dashboard cards and analytics presentation
│   ├── feature/                      # Subject and chapter presentation components
│   ├── navigation/                   # Swipe navigation shell
│   ├── onboarding/                   # Onboarding step components
│   └── ui/                           # Shared visual primitives and sheets
├── contexts/                         # Global app, theme, and language contexts
├── hooks/                            # Reusable React hooks
├── features/                         # Domain-owned non-route code
│   ├── analytics/services/           # Chapter analytics transforms and view models
│   ├── core/services/                # Supabase client, storage, cache, codec, haptics
│   ├── focus/services/               # Streak-recovery policy and rules
│   ├── leaderboard/services/         # Rank-transition and celebration logic
│   ├── notifications/services/      # Admin, local notification, and attachment services
│   ├── productivity/services/       # Calendar, to-do, and subject-timer persistence
│   ├── profile/services/             # Avatar policy, image processing, and session history
│   ├── progression/services/         # Weekly XP zones and level progression rules
│   ├── referrals/services/           # Referral statistics and regression rules
│   └── tracker/services/             # Tracker reconciliation and state rules
├── constants/                        # Theme tokens, translations, levels, goals, messages
├── types/                            # Shared domain models
├── supabase/                         # Migrations, reports, configuration, Edge Functions
├── assets/                           # Logos, splash screens, and other static assets
├── docs/                             # Architecture and operational documentation
├── CHANGELOG.md                      # Human-readable release and change history
├── .env.example                      # Safe environment-variable template
└── package.json                      # Scripts and dependency manifest
```

### Why route files remain inside `app/`

Expo Router derives navigation from the filesystem. A file such as `app/focus/active.tsx` is not merely a component; it is also the `/focus/active` route. The refactor therefore keeps route files in their current paths and moves only reusable services into `features/`. This gives the project domain boundaries without changing deep links, tabs, reset-password links, or existing navigation paths.

## Getting started

Install the project with pnpm and create a local environment file from the safe template:

```bash
pnpm install
cp .env.example .env
```

Set the public Supabase URL and publishable/anonymous key in `.env`. Do not add service-role keys, database passwords, OAuth client secrets, or push credentials to the repository. The local `.env` file is ignored by Git.

Start the Expo development server with:

```bash
pnpm start
```

Use the Expo CLI prompts to open Android, iOS, or web. Native builds require the corresponding Android SDK/device or Xcode/iOS simulator outside this repository.

## Verification commands

Run the same checks used before a production push:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec expo lint
pnpm exec expo export --platform web --output-dir web-export
rm -rf web-export
```

The test suite covers password-policy boundaries, referral rules, cache compression, chapter analytics, tracker reconciliation, session history, streak recovery, weekly XP, theme contrast, and leaderboard rank transitions.

## Supabase conventions

The client uses the public Supabase key and relies on **Row Level Security** and server-side RPC/Edge Function authorization as security boundaries. Every schema change belongs in a timestamped file under `supabase/migrations/`. Production DDL and policy changes must be applied through the Supabase migration workflow and then re-verified with bounded queries.

Sensitive administrative operations must never trust a client-side role flag. The deployed admin-notification Edge Function verifies the authenticated user and checks the server-side admin table before using privileged access. User-owned data must remain constrained by `auth.uid()` ownership policies.

## Authentication and security notes

The active authentication flow is in `auth/AuthSessionProvider.tsx` and `auth/AuthScreen.tsx`. It handles email confirmation, signup referral normalization, login errors, reset links, and sign-out state. The minimum password length remains six characters as required by the product decision.

The current web target is an Expo static client, so its Supabase session is persisted by the browser client. A true HttpOnly-cookie migration requires a separate server-side web/BFF runtime with PKCE and a cookie exchange endpoint; it cannot be achieved safely by changing one client storage adapter. Native clients continue to use a native storage adapter.

## Contribution and refactor rules

Keep route filenames stable unless a navigation change is intentional and fully tested. Put new reusable domain logic under the matching `features/<domain>/` folder. Put cross-domain infrastructure under `features/core/`. Keep presentation components in `components/` unless they are route-specific. Add or update a focused test when changing business rules, data transforms, security boundaries, or cache behavior.

Before committing, inspect the diff, run `git diff --check`, and confirm that no `.env`, credentials, service-role key, or temporary deployment file is staged.

## Documentation

The [architecture guide](docs/ARCHITECTURE.md) explains ownership boundaries and import conventions. The [change history](CHANGELOG.md) records the folder refactor, security hardening, performance work, and previous product improvements.

## License and ownership

PadhAI is maintained by **Devansh**. Add an explicit open-source license before distributing the code publicly; no license is inferred by this repository documentation.
