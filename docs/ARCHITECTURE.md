# PadhAI Architecture Guide

## Architectural principle

PadhAI uses a **route-first, feature-oriented** structure. The `app/` directory is owned by Expo Router and contains route modules. The `features/` directory contains domain logic that can be reused by route modules, contexts, and components without changing navigation paths.

> **Rule:** A file under `app/` is both code and a public navigation contract. Move it only when intentionally changing a route and updating every deep link, redirect, tab declaration, and test.

## Ownership map

| Domain | Route surface | Non-route code |
|---|---|---|
| Authentication | `app/index.tsx`, `app/login.tsx`, `app/reset-password.tsx` | `auth/` |
| Focus | `app/(tabs)/focus.tsx`, `app/focus/*`, `app/streak-broken.tsx` | `features/focus/services/` |
| Tracker | `app/(tabs)/tracker.tsx`, `app/tracker/*` | `features/tracker/services/`, `components/feature/` |
| Analytics | `app/(tabs)/analytics.tsx`, `app/analytics.tsx` | `features/analytics/services/`, `components/dashboard/` |
| Leaderboard | `app/(tabs)/leaderboard.tsx` | `features/leaderboard/services/`, `features/progression/services/` |
| Notifications | `app/notifications.tsx`, `app/admin/notifications.tsx` | `features/notifications/services/` |
| Profile and referrals | `app/(tabs)/profile.tsx`, `app/referral.tsx` | `features/profile/services/`, `features/referrals/services/` |
| Productivity | `app/calendar.tsx`, `app/todo.tsx` | `features/productivity/services/` |
| Shared infrastructure | Root layout and all domains | `features/core/services/`, `contexts/`, `hooks/`, `constants/`, `types/` |

## Import conventions

Use the `@/` alias for cross-domain imports. For example:

```ts
import { supabase } from '@/features/core/services/supabase';
import { getRecentSessions } from '@/features/profile/services/sessionHistory';
import type { UserProfile } from '@/types/models';
```

Keep same-folder imports relative when a test and its implementation are intentionally co-located. Do not create a second Supabase client inside a feature; use `features/core/services/supabase.ts`.

## Data boundaries

The client owns presentation state and local cache orchestration. Supabase owns synchronized user data, row-level authorization, relational integrity, server-side RPC rules, Storage policies, and administrative authorization. A component may request a service operation, but it must not bypass the service or RLS boundary to write privileged data directly.

## Adding a feature

Create a route under the correct `app/` path only when a new navigation destination is needed. Create domain logic under `features/<domain>/services/`, reusable visual elements under `components/<domain>/`, and tests beside the business-rule implementation. If a feature needs global state, add it to an existing context only when the state is genuinely cross-screen; otherwise keep it local to the route or service.

For a Supabase schema change, add a timestamped migration under `supabase/migrations/`, apply it to the intended project, and re-run the affected RLS, function, and integrity checks. Never store credentials in source files, migrations, documentation, or test fixtures.

## Refactor checklist

Before a refactor is pushed, confirm that route paths are unchanged unless explicitly intended, all imports resolve, tests pass, TypeScript passes, lint passes, the web export succeeds, `git diff --check` is clean, and the staged file list contains only intended changes. Verify that `.env` and temporary audit artifacts are not staged.
