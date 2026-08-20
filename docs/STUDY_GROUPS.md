# PadhAI Study Groups

## Scope

PadhAI now includes a zero-cost Study Groups feature for students who want to study together and see approved members’ live study status. The feature supports private groups with invite-token joining and owner approval, public groups discoverable through search, local built-in study icons, rules and daily goals, member leave, moderation reports, support tickets, and owner-wide oversight.

## Data and realtime design

Permanent study time is derived from the existing PadhAI focus-session lifecycle. A group session is written only when a focus session completes or breaks, while active presence is updated with a low-write heartbeat and rendered locally between updates. Stale presence is treated as offline after 90 seconds. Group-list data is compressed in the existing phone cache with a 60-second TTL.

The implementation adds the following production tables: `study_groups`, `study_group_members`, `study_group_invites`, `study_group_presence`, `study_group_sessions`, `study_group_reports`, and `study_group_tickets`. The tracked migrations are `20260820_study_groups_moderation.sql`, `20260820_study_groups_member_summary.sql`, `20260820_study_groups_pending_visibility.sql`, `20260820_study_groups_pending_summary.sql`, `20260820_study_groups_owner_only_moderation.sql`, `20260821_study_groups_permissions_and_group_reports.sql`, and `20260821_study_groups_group_settings.sql`. The existing membership row stores a compact JSON permission checklist; no audit-log table or additional storage bucket was added.

## Access rules

A private group is visible to its approved members, its owner/admin, the PadhAI owner, or a user with their own pending membership. Pending members can see only their own group preview and approval state; member activity is returned through a secure RPC only after approval. Public search is bounded to 100 results. Owner and admin operations are protected by server-side SECURITY DEFINER RPC checks using `auth.uid()` and fixed search paths. All new tables have RLS enabled.

The PadhAI owner can inspect every group without joining and can review all reports and tickets from the private owner inbox. The group owner has full group-management authority. A co-admin receives only the saved checklist permissions: managing join requests is optional, while member removal, invite management, group editing, co-admin assignment, co-admin permission editing, and co-admin demotion can be enabled or disabled individually. A co-admin can manage only lower-rank members/co-admins and can never change the owner. No group admin can read or resolve any complaint or app-level ticket. Users cannot report individual members; they can report the group from the three-dot menu before joining, from an invite preview, or from the group detail header. Reports go only to the PadhAI owner. The Review Tickets/Reports route and sidebar entry are owner-only.

Invite management now has separate `Copy link`, `Share invite`, and `Regenerate invite` actions. Copying uses the installed Expo Clipboard module and shows an explicit “Invite link copied” notice; report confirmation and invite-action notices use separate messages.

## User flows

The sidebar now includes Study Groups, Help & Support → Report a problem, and owner-only Review tickets/reports. The Study Groups home screen loads the user’s memberships cache-first, supports bounded public search, and links to group creation or invite-token joining. Every group card has a three-dot menu for reporting before joining, and invite previews expose the same action for private groups. The group detail screen displays live `Studying`, `Paused`, and `Offline` states, today’s genuine study time, group total, rules, icon selection, group-session start, permission-gated requests/invites/editing, long-press co-admin management, leave, and group-only reporting. Reports use MCQ reasons plus an optional “Tell us more” field, include scam/fraud and unsafe/illegal-content categories, and show an animated thank-you confirmation after submission.

## Verification

The complete regression suite passed with 62 tests after the permission and reporting changes. TypeScript compilation, Expo lint, diff validation, and a clean Expo web export are required release gates. Public RPCs use SECURITY INVOKER wrappers while privileged implementations remain in the private schema with authenticated-only execution and server-side `auth.uid()`/rank/permission checks. Production RLS keeps report reads owner-only, and the new report RPC validates public visibility, pending membership, or a valid invite before inserting a group-only report.

No paid services, new storage buckets, external APIs, credentials, or background paid workers were added. Password protection settings were not changed.
