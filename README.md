# Welcome to PadhAI ( Developer :- Devansh )

➥ Study hard. No excuses.”

# PadhAI - Productive Study & Focus Tracker

A modern mobile app built with React Native Expo and Supabase to help students stay focused, organize notes, track habits, and gamify their preparation for school and competitive exams.

---

## 🔐 Critical Authentication Components (DO NOT TOUCH)

> ### ⚠️ CRITICAL WARNING FOR REFACTORING / GITHUB COMMITS
> The following authentication files are **frozen** and part of the core infrastructure. Under no circumstances should these files be **deleted**, **renamed**, or **moved** during refactor commits or feature updates. Doing so will break the dynamic authentication gates, route syncing, and session handling with Supabase.

All auth components are located strictly inside the `components/auth/` directory:

| File Name | Path | Purpose / Responsibility |
| :--- | :--- | :--- |
| **`LoginForm.tsx`** | `components/auth/LoginForm.tsx` | Handles user authentication via Supabase. Includes custom database check before password resets (`resetPasswordForEmail`) to block requests for non-existent accounts, inline error handling, and onboarding redirection logic. |
| **`SignupForm.tsx`** | `components/auth/SignupForm.tsx` | Manages registration flow for new users, prevents duplicate registration alerts for new Gmail entries, and syncs basic user metadata seamlessly to the backend. |
| **`AuthInput.tsx`** | `components/auth/AuthInput.tsx` | Reusable custom text input element used throughout the auth system. Handles local state focus, placeholder text colors, and highlights validation fields with strict visual indicator styles when an error is passed. |
| **`AuthButton.tsx`** | `components/auth/AuthButton.tsx` | Reusable system button that handles loading states, dynamic label rendering, opacity adjustments during async Supabase triggers, and primary/ghost visual variants. |
| **`AuthLogo.tsx`** | `components/auth/AuthLogo.tsx` | Displays the standard corporate branding logo ("पढ़AI") along with system-wide motivational taglines to keep UI design unified. |

---

## 🛠️ Project Structure Map

```text
PadhAI/
├── app/                        # App routing and screen navigation (Expo Router)
│   ├── (tabs)/                 # Main dashboard tabs (analytics, focus, profile, tracker)
│   ├── focus/                  # Focus timer interfaces (active, broken, complete, levelup)
│   ├── tracker/                # Chapter/Subject level granular study progress logs
│   ├── _layout.tsx             # Global application routing root layout
│   └── index.tsx               # Main Auth screen route wrapper (loads LoginForm/SignupForm)
├── assets/                     # Media resources (fonts, image layers, logo mockups)
├── components/                 # Reusable interface components
│   ├── auth/                   # 🔴 CRITICAL - Auth modules (LoginForm, SignupForm, etc.)
│   ├── dashboard/              # Home page cards (GreetingCard, StatsRow, QuoteCard)
│   ├── feature/                # Core interactive elements (ChapterItem, SubjectCard)
│   ├── onboarding/             # New user setup workflow (StepName, StepExam, StepGoal)
│   └── ui/                     # Small level UI elements (StreakBadge, XPBar)
├── constants/                  # Color configurations, system configurations, level charts
├── contexts/                   # AppContext.tsx (Global session and data orchestration)
├── hooks/                      # Custom hooks (useApp, useThemeColor, useColorScheme)
├── services/                   # Storage handlers (storage.ts) and Backend clients (supabase.ts)
└── types/                      # TypeScript strictly structured structural definitions (models.ts)
