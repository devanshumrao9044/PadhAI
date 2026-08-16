# Full Audit – Authentication Findings

The web preview opened the login screen successfully. The login UI exposes email, password, sign-in, forgot-password, create-account, privacy-policy, and a disabled-looking Google signup coming-soon control. The signup UI exposes full name, email, optional referral code, password, create-account, back-to-sign-in, and privacy policy. Referral input visibly instructs users to use uppercase letters.

A disposable signup was filled with `padhai.audit.invalid.1625@example.com` and non-existent referral code `NOPE99999`. Submission was accepted by the UI and entered a loading state; the final response still needs to be observed to confirm that account creation is blocked and that a clear error is rendered. No real user credentials or data were used.

The invalid referral test returned `Invalid referral code. Please check it and try again.` inline below the referral field, and the signup form remained open without creating an account. A malformed-input submit then displayed `Please enter a valid email address.` below the email field and `Password must be at least 6 characters.` below the password field. Errors were field-local and readable; the browser automation did not successfully clear the previously entered name/referral values when given empty strings, so missing-name validation remains to be tested independently.

The valid signup test was prepared with `padhai.audit.valid.1625@example.com` and password `Audit123!`. Clearing the optional referral field with direct input worked and restored its placeholder state; this path is ready for submission.

The disposable no-referral signup succeeded and redirected to the authenticated home route. The home dashboard displayed the submitted name `PadhAI Audit Valid`, default streak/XP/focus values, quick-access cards, daily thought, and tab navigation. This confirms the signup trigger, session hydration, initial profile creation, and post-signup routing path work in the web preview.

The authenticated profile screen loaded successfully. It displayed the test user identity, rank/XP/streak cards, account information, privacy-policy row, dark-mode switch, referral code `PADH13668`, referral reward counters, and sign-out action. The sign-out action opened a clear confirmation modal with Cancel and Sign Out choices; no unexpected navigation occurred before confirmation.

Sign-out confirmation returned the browser to `/login`; the protected profile route did not remain visible. Logging back in with the same disposable credentials redirected to `/` and loaded the authenticated home dashboard. The dashboard showed the generic `Student` profile label after relogin, while the earlier signup session showed the submitted display name; this may indicate inconsistent profile hydration or a trigger/profile data issue and should be checked against the production `users` row.

While authenticated, navigating directly to `/login` initially showed the login snapshot but then the app redirected back to `/` on the next render. A stale-element click was safely rejected and refreshing the snapshot confirmed the user was back on the protected home route. This indicates the route guard eventually protects the login route, but the transient login render should be reviewed for flicker/race behavior. Forgot-password testing still requires signing out first.

A second profile navigation and sign-out attempt again opened the confirmation modal consistently. The modal behavior is repeatable and does not immediately sign out before confirmation.

After signing out, the forgot-password screen opened normally with email input, Send reset link, Back to sign in, Cancel, and Privacy Policy controls. The reset flow is available only after sign-out as expected.

The reset form rejected `not-an-email` with `Please enter a valid email address.` displayed directly under the email field. This validation path is working and does not submit a reset request for malformed input.

A reset request using the valid-format disposable account email at `example.com` was rejected by Supabase with `Email address ... is invalid`. The client displayed this provider error inline. Because the same address was accepted during signup, this appears to be a provider/domain-policy edge case rather than a client format error; it should be checked against Supabase Auth logs and, if needed, mapped to a clearer user-facing message.

Relogin reproduction confirmed the suspected race: immediately after sign-in, the rendered viewport showed `Student` in the greeting, while the extracted dashboard content already contained the correct persisted name `PadhAI Audit Valid`. This indicates a transient dashboard render before profile hydration completes, not corrupted production profile data. The fix should gate protected content until AppContext has completed the signed-in profile load or render an explicit loading state instead of the `Student` fallback.

After the hydration-gate change hot-reloaded, the dashboard settled with `PadhAI Audit Valid`, and the Profile screen consistently showed the same name, username, class, and referral code. The corrected login flow now leaves redirect timing to AuthRouteGuard so the dashboard is not mounted before profile hydration.

Post-fix, Profile still opens a confirmation modal before sign-out; the modal contains Cancel and Sign Out actions and does not sign out prematurely.

The confirmed sign-out returned directly to `/login`. Submitting a wrong password kept the user signed out and rendered `Email or password is incorrect.` directly under the password field; no crash or protected-route navigation occurred.

A duplicate signup using the existing audit email was blocked by Supabase and mapped to the email field as `An account with this email already exists. Try signing in instead.` No second account was created and the signup form remained open.

During the next study-flow cycle, clicking Sign in once left the valid credentials on the login screen; this needs a wait/second-state check rather than being treated as a failed credential test because the prior relogin succeeded and the current screen snapshot was taken immediately after submission.

After waiting, the valid login completed successfully and opened the dashboard with `PadhAI Audit Valid`. Tracker initially showed no subjects; adding `Audit Physics` succeeded, the subject appeared immediately in the list, and no RLS or save error was shown.

Adding `Kinematics Audit` created a production row successfully, confirmed by a scoped SQL query, but the subject detail screen continued to display `0 chapters` because it memoized a selector whose callback identity was intentionally stable. The selector was changed to recompute from the latest AppContext state; hot reload then showed `1 chapter`, `Kinematics Audit`, and `Not Started` immediately. This was a confirmed UI synchronization bug, not a database insert failure.

The Study Session screen opened from the subject detail with `Audit Physics` and `Kinematics Audit` preselected. Selecting 15 minutes changed the expected XP preview to +30 XP, and Lock In created the active session. The active screen displayed `Audit Physics`, a 15-minute timer, and focus-mode controls; the chapter attribution is stored in the active session state and will be verified in production after completion.

For deterministic audit execution, the browser test clock was advanced by 15 minutes; the normal timer callback completed the session and routed to `Session Complete!` with `+30 XP earned` and `30 Weekly XP`. This exercised the production completion path rather than directly inserting test data.

The first completed production row correctly stored `subject_id` and `chapter_id = null`; the Study Session route supplied a subject but the chapter chip remained on `General`. This is valid subject-only behavior, so an explicit chapter-selection retest is required before treating chapter attribution as defective.

The explicit retest selected `Audit Physics`, then `Kinematics Audit`, and visibly highlighted the chapter chip before Lock In. The accelerated timer completed the normal flow with `+50 XP earned` and `80 Weekly XP`; the resulting production row is now being checked for non-null `chapter_id`.

The production query confirmed the latest row with `planned_minutes = 25`, `actual_minutes = 25`, `completed = true`, `broken = false`, `xp_earned = 50`, `subject_id = Audit Physics`, and `chapter_id = Kinematics Audit`. Chapter attribution and XP synchronization work when the chapter is explicitly selected.

Returning Home updated streak, 40 minutes of focus, 80 weekly XP, daily goal progress, and chapter count. However, both the Home Chapter Focus card and the immediately opened Analytics screen still showed no chapter-linked analytics; this remained after waiting for realtime reload. The daily/session aggregates updated, so the remaining defect is specifically chapterAnalytics hydration or refresh timing.

Adding a mount/account-change `reload()` effect to both native and web Home dashboards fixed the stale analytics card: returning Home now shows `Kinematics Audit`, `25m`, `1 session · 1 completed`. Analytics route verification continues below its summary charts.

The chapter delete action removed `Kinematics Audit` immediately from the subject detail, which now reports `0 chapters` and shows the empty state. This confirms local state updates cleanly after the soft-delete request; production and analytics filtering remain to be checked.

The production query confirmed `Kinematics Audit` remains as a row with `is_deleted = true`, preserving historical data while excluding it from active chapter queries. Navigating to a fresh root after the accelerated-clock test landed on the signed-out login screen, so the clock harness likely invalidated or refreshed the browser auth session; the clock was restored and reauthentication is required before final post-delete UI verification.

The app subsequently returned to the authenticated Home state without user input; the dashboard displayed `0/0 Chapters` and `No chapter-linked sessions yet`, confirming the deleted chapter is filtered from active UI analytics while its historical session remains in production.

Subject deletion was then exercised from the Audit Physics detail screen. It returned to Tracker without an RLS error, and Tracker displayed `No subjects found`. This confirms the previously reported subject-delete RLS regression is fixed in the UI path; the production subject flag is being verified next.

The production query confirmed `Audit Physics` is retained with `is_deleted = true`. Historical focus-session and chapter rows remain available for integrity, while the active subject/chapter UI is empty.

Profile audit: the page displayed the correct hydrated identity, Rank 1 / Promotion, `PADH13668` in uppercase, and `RECENT SESSIONS (LATEST 3)` with the two completed audit sessions shown. Light mode toggled successfully; the visible profile labels, privacy row, referral code, session history, and counters remained readable against the high-contrast light palette.

Analytics and Ranks were readable in light mode. Ranks showed one leaderboard entry, 80 XP, Rank 1, and the pointer at the promotion end; the RankZoneBar explicitly treats a one-player leaderboard as fully promoted. The history helper deduplicates by session ID, sorts newest first, and slices to the requested limit of three.

The theme switch was toggled back to Dark mode successfully, restoring the original dark appearance for the remainder of the audit.

Referral audit: the dedicated screen displayed uppercase code `PADH13668`, progress `0 / 5`, correct +25/+50 XP instructions, and the Copy control changed to `Copied` after activation. Referral state remained consistent with Profile counters.

Authenticated Profile privacy navigation initially returned Home because AuthRouteGuard treated `/privacy-policy` as an unauthenticated landing candidate. The guard now allowlists `/privacy-policy` and `/reset-password` for active sessions. Retesting opened the full dark-theme policy with readable headings and paragraphs, effective date, data-use/security/retention sections, Google-auth scope, and contact address `materialhubx@gmail.com`.

A combined hostile subject value, `<img src=x onerror=alert(1)>OR1=1--`, was accepted as ordinary text, rendered literally in Tracker and the subject-detail header, and produced no script execution or query-side behavior. The subject was deleted afterward and Tracker returned to its empty state. The implementation uses Supabase parameter APIs for persistence and native text rendering rather than HTML injection.

After revoking anonymous referral RPC execution, signup with `BADCODE1` still stayed on the signup screen and showed `Invalid referral code. Please check it and try again.` directly under the referral field. A production query of `auth.users` for the disposable email returned no rows, confirming the trigger rolled back the invalid signup rather than creating a partial account.

Native-device check: the sandbox has no `adb`, Android emulator binary, `ANDROID_HOME`, or `ANDROID_SDK_ROOT`. Android emulator execution is therefore unavailable here; native risk coverage will rely on the shared React Native source, Expo export, TypeScript, lint, and web interaction checks, with this platform limitation documented explicitly.

A production repeat harness completed ten invalid-referral signup attempts, all rejected with `P0001 Invalid referral code`; ten valid-password sign-ins, all HTTP 200 with access tokens; one owner-scoped `users` read returning exactly one row; and ten `process_referral_bonus` calls for the signed-in user, all safe HTTP 200 no-op responses because no pending referral existed. The raw evidence is preserved in `tmp/repeat_critical_flows_result.json`.
