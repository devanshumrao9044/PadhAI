# Welcome to PadhAI 

➥ Study hard. No excuses.”

# PadhAI - Productive Study & Focus Tracker

A modern mobile app built with React Native Expo and Supabase to help students stay focused, organize notes, track habits, and gamify their preparation for school and competitive exams.

---

## 🔐 Critical Authentication Components (DO NOT TOUCH)

> ### 🔴 CRITICAL SAFETY WARNING FOR GITHUB COMMITS & REFACTORS
> **DO NOT REMOVE OR DELETE THE `components/auth/` DIRECTORY OR ANY FILES WITHIN IT.**
> During automated cleanups, branching operations, or git refactor commits, files like `LoginForm.tsx` are being accidentally wiped out. To prevent this, a protective `.gitkeep` file has been added. Any commit that modifies, moves, or deletes these files will immediately break session handling, Supabase endpoints, and routing checkpoints.

All auth components are located strictly inside the protected `components/auth/` directory:

| File Name | Path | Purpose / Git Protection Status |
| :--- | :--- | :--- |
| **`.gitkeep`** | `components/auth/.gitkeep` | **Git Protection Anchor.** Keeps the directory tracked in remote repositories even during heavy cleanup or branch swapping operations. **NEVER DELETE.** |
| **`LoginForm.tsx`** | `components/auth/LoginForm.tsx` | Handles user authentication via Supabase. Includes custom database checks before password resets (`resetPasswordForEmail`) to block requests for non-existent accounts, inline error handling, and onboarding redirection logic. |
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
│   ├── auth/                   # 🔴 CRITICAL STORAGE - Auth modules & .gitkeep tracking anchor
│   ├── dashboard/              # Home page cards (GreetingCard, StatsRow, QuoteCard)
│   ├── feature/                # Core interactive elements (ChapterItem, SubjectCard)
│   ├── onboarding/             # New user setup workflow (StepName, StepExam, StepGoal)
│   └── ui/                     # Small level UI elements (StreakBadge, XPBar)
├── constants/                  # Color configurations, system configurations, level charts
├── contexts/                   # AppContext.tsx (Global session and data orchestration)
├── hooks/                      # Custom hooks (useApp, useThemeColor, useColorScheme)
├── services/                   # Storage handlers (storage.ts) and Backend clients (supabase.ts)
└── types/                      # TypeScript strictly structured structural definitions (models.ts)
