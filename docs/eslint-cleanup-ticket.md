# ESLint Warning Cleanup Ticket

**Title:** Remove 13 non-blocking ESLint warnings from the PadhAI Expo app

**Status:** Planned

**Priority:** Medium overall; the focus-session lifecycle warnings are high priority because they touch timers, realtime subscriptions, and navigation.

## Context

The current validation run passes TypeScript, all 23 automated tests, and the Expo web export. ESLint reports **13 warnings and 0 errors**. The warnings fall into three categories: one duplicate-import issue, two unused-variable issues, and ten React Hook dependency warnings.

The cleanup should be implemented in small, behavior-preserving commits. Animation-only effects should not receive dependencies blindly if doing so restarts an animation on every render; instead, the implementation should either use stable references, add an appropriate one-time suppression with a documented reason, or refactor the animation setup into a stable callback. Timer, realtime, and navigation effects must be reviewed before any dependency array is changed.

## Warning Inventory

| ID | File and line | Rule | Finding | Priority | Recommended action |
|---|---|---|---|---|---|
| ESLINT-01 | `app/(tabs)/analytics.tsx:1` | `import/no-duplicates` | The main React import is duplicated by a second import from `react`. | Low | Merge the imports and rerun lint. |
| ESLINT-02 | `app/(tabs)/analytics.tsx:7` | `import/no-duplicates` | `useCallback` is imported separately from `react`. | Low | Move `useCallback` into the existing React import. |
| ESLINT-03 | `app/(tabs)/leaderboard.tsx:3` | `@typescript-eslint/no-unused-vars` | `TouchableOpacity` is imported but unused. | Low | Remove the unused import. |
| ESLINT-04 | `app/(tabs)/leaderboard.tsx:39` | `react-hooks/exhaustive-deps` | `LevelBadge` startup animation uses `scale` with an empty dependency array. | Low | Confirm `scale` is a stable `useRef(...).current`; then either use the project’s documented stable-animation pattern or suppress this single warning with a comment explaining why the effect must run once. |
| ESLINT-05 | `app/focus/active.tsx:140` | `@typescript-eslint/no-unused-vars` | `initialRemaining` is calculated but never used. | Low | Remove it unless the timer bootstrap intentionally needs to display or persist that value; add a focused test if the value is restored. |
| ESLINT-06 | `app/focus/active.tsx:190` | `react-hooks/exhaustive-deps` | Timer/AppState/BackHandler setup captures `activeSession`, `plannedSecs`, `router`, and `tick`, but depends only on `isLoading`. | High | Refactor before changing dependencies. Use stable callbacks or refs for `tick`, preserve one timer/subscription lifecycle, and verify session changes, planned duration changes, app background/foreground transitions, completion, and cleanup. |
| ESLINT-07 | `app/focus/active.tsx:242` | `react-hooks/exhaustive-deps` | Realtime focus-session subscription captures `router` but depends only on `activeSession?.sessionId`. | High | Add a stable router reference or include the safe dependency after confirming the channel is not recreated unnecessarily. Test update-to-complete and update-to-broken navigation plus channel cleanup. |
| ESLINT-08 | `app/focus/complete.tsx:43` | `react-hooks/exhaustive-deps` | `ConfettiDot` animation references `delay`, `startX`, and animated refs inside a one-time effect. | Medium | Preserve one-time animation behavior. Prefer stable-input handling or a documented targeted suppression; add timeout/loop cleanup if needed. |
| ESLINT-09 | `app/focus/complete.tsx:159` | `react-hooks/exhaustive-deps` | Main completion animation references many stable animated refs and `isComeback`/`isRecovery`, but runs once. | Medium | Refactor the animation sequence into a stable setup function, include condition dependencies only if restart behavior is intended, and clean up both timeouts and loops on unmount. |
| ESLINT-10 | `app/focus/levelup.tsx:39` | `react-hooks/exhaustive-deps` | `Particle` animation references `delay`, `x`, `y`, and animated refs in a one-time effect. | Low | Apply the same documented stable-animation pattern as `ConfettiDot`; ensure the loop stops on unmount. |
| ESLINT-11 | `app/focus/levelup.tsx:134` | `react-hooks/exhaustive-deps` | Level-up startup animation references stable animated refs but runs once. | Low | Apply the shared animation-effect pattern and verify no duplicate loops are created. |
| ESLINT-12 | `app/streak-broken.tsx:65` | `react-hooks/exhaustive-deps` | Startup animation references stable animated refs and a timeout. | Low | Add cleanup for the timeout and use the shared stable-animation convention. |
| ESLINT-13 | `components/ui/SideDrawer.tsx:64` | `react-hooks/exhaustive-deps` | Drawer open/close effect references `slideAnim` and `overlayAnim` in addition to `visible`. | Medium | Confirm the refs are stable, preserve the visible-driven animation lifecycle, and use either a safe dependency pattern or a narrowly documented suppression. |

## Important Counting Note

The source output contains **13 warning entries**. The two focus-active lifecycle warnings are tracked separately above and grouped into one high-priority implementation workstream because they affect the same timer and realtime screen.

## Recommended Implementation Order

### Phase A: Trivial correctness cleanup

Remove the duplicate React import, remove `TouchableOpacity`, and remove `initialRemaining` after confirming it has no intended side effect. This should eliminate three warnings with negligible runtime risk.

### Phase B: Focus-session lifecycle hardening

Address `app/focus/active.tsx` before the animation screens. This work must avoid recreating intervals, AppState listeners, BackHandler listeners, or Supabase channels unnecessarily. The implementation should use stable callbacks or refs where needed and must cover session switching, planned-duration changes, background/foreground transitions, realtime completion, broken-session navigation, unmount cleanup, and router navigation.

### Phase C: Animation-effect standardization

Standardize the one-time animation effects in `complete.tsx`, `levelup.tsx`, `streak-broken.tsx`, and `SideDrawer.tsx`. A shared convention should be chosen: either a small documented lint suppression for stable `useRef` animation values, or a refactor that makes the effect dependencies explicit without restarting animations unexpectedly. Timeout and animation-loop cleanup should be included in the same pass.

## Acceptance Criteria

1. `npm run lint` reports **0 errors and 0 warnings**.
2. `npx tsc --noEmit` passes.
3. The complete Node.js test suite remains at **23 passed and 0 failed**, or any intentional test-count change is documented.
4. Expo web export succeeds and still generates all 28 routes.
5. Focus sessions continue to complete exactly once, including after background/foreground transitions.
6. Realtime `focus_sessions` updates still navigate correctly to complete and broken-session screens, and all channels/listeners are removed on unmount.
7. Completion, level-up, streak-broken, and drawer animations run once when intended, stop cleanly on unmount, and do not restart on unrelated rerenders.
8. No `eslint-disable` is added without a local explanation of why the dependency is intentionally stable and why adding it would create incorrect lifecycle behavior.

## Suggested PR Breakdown

| PR | Scope | Expected risk |
|---|---|---|
| PR-1 | Duplicate imports, unused imports, and unused local | Very low |
| PR-2 | Focus active timer, AppState, BackHandler, realtime channel, and navigation dependency cleanup | High; requires focused manual and automated verification |
| PR-3 | Completion and celebration animation dependency/cleanup standardization | Medium |
| PR-4 | Streak-broken and SideDrawer animation cleanup, final lint/build regression run | Low to medium |

## Definition of Done

The ticket is complete when all warning entries are resolved or individually justified, the acceptance criteria pass, the final lint output is clean, and the changes are pushed as focused commits to `main` after review.

## References

[1]: https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps "React exhaustive-deps lint rule"

[2]: https://react.dev/reference/react/useEffect "React useEffect reference"
