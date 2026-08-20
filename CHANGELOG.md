# Changelog

All notable PadhAI changes are recorded here in reverse chronological order. The entries summarize repository-level work; product-specific details remain in the relevant feature and migration files.

## 2026-08-20 — Repository organization and audit hardening

The project was reorganized without changing Expo Router route paths. Shared service code now lives under domain-owned `features/` folders for core infrastructure, focus, tracker, analytics, leaderboard, notifications, profile, productivity, progression, and referrals. Cross-domain imports use the `@/` alias so future moves are easier to review.

The outdated README was replaced with a complete setup, architecture, security, testing, and contribution guide. `docs/ARCHITECTURE.md` was added to document route ownership and safe refactor rules.

The production leaderboard RPC now enforces a server-side maximum of 30 rows. The unused privileged full-database export RPC was removed. The tracked local `.env` file was removed from Git, a safe `.env.example` was added, and local credentials remain ignored.

The repository and production Supabase project were re-audited. The authenticated production harness completed 100 bounded checks across ten repetitions with zero failures, the anonymous protected-endpoint probes remained denied, and all bounded integrity checks remained clean.

## 2026-08-19 — Admin notifications and attachment hardening

The owner/admin notification workflow was completed with server-side authorization, recipient targeting, level-based delivery, notification inbox support, in-app image/PDF attachment rendering, user deletion of their own notification records, attachment storage restrictions, and notification foreign-key indexes.

## 2026-08-18 — Referral and analytics reliability

Referral completion metadata and first-session reward handling were hardened. Chapter analytics and referral bonus RPCs were restricted to authenticated, authorized callers. Analytics was synchronized with active tracker relationships so deleted subjects and chapters do not remain visible as active study data.

## 2026-08-17 — Product experience and backend protection

The level-wise leaderboard was redesigned with live status, cache-first loading, top-three celebration behavior, and level-aware ranking. Subject deletion became atomic, avatar storage policies were tightened, the avatar bucket was restricted, and legacy avatar access was removed.

## 2026-08-16 — Account, tracker, and weekly progression fixes

Email confirmation requirements, signup-trigger reliability, referral validation, focus-session chapter attribution, chapter analytics, subject RLS, and referral access rules were updated. Weekly XP rules were implemented for Sunday reset behavior, promotion/safety/demotion zones, and level transitions.

## 2026-08-15 — Initial security and storage hardening

The first security hardening migrations added ownership indexes, tightened RLS and RPC privileges, validated signup referral codes, hardened avatar storage, and reduced unnecessary database exposure. Password-protection configuration remained a deliberate product-controlled boundary.

## Earlier product work

Earlier iterations added onboarding for all supported study goals, bilingual English/Hindi settings, dark/light theme tokens with contrast tests, haptic feedback, custom tab swipe navigation, compressed local caching, focus-session history limited to the latest three sessions, streak recovery rules, notification settings, and UI polish across the main dashboard, tracker, analytics, profile, settings, and leaderboard screens.
