# PadhAI Study Groups

## Scope

PadhAI now includes a zero-cost Study Groups feature for students who want to study together and see approved members’ live study status. The feature supports private groups with invite-token joining and owner approval, public groups discoverable through search, local built-in study icons, rules and daily goals, member leave, moderation reports, support tickets, and owner-wide oversight.

## Data and realtime design

Permanent study time is derived from the existing PadhAI focus-session lifecycle. A group session is written only when a focus session completes or breaks, while active presence is updated with a low-write heartbeat and rendered locally between updates. Stale presence is treated as offline after 90 seconds. Group-list data is compressed in the existing phone cache with a 60-second TTL.

The implementation adds the following production tables: `study_groups`, `study_group_members`, `study_group_invites`, `study_group_presence`, `study_group_sessions`, `study_group_reports`, and `study_group_tickets`. The tracked migrations are `20260820_study_groups_moderation.sql`, `20260820_study_groups_member_summary.sql`, `20260820_study_groups_pending_visibility.sql`, and `20260820_study_groups_pending_summary.sql`.

## Access rules

A private group is visible to its approved members, its owner/admin, the PadhAI owner, or a user with their own pending membership. Pending members can see only their own group preview and approval state; member activity is returned through a secure RPC only after approval. Public search is bounded to 100 results. Owner and admin operations are protected by server-side SECURITY DEFINER RPC checks using `auth.uid()` and fixed search paths. All new tables have RLS enabled.

The PadhAI owner can inspect every group without joining and can review reports and tickets from the owner view. Group owners/admins can approve or reject requests, share or regenerate invites, archive their group, and review group-level moderation items. Normal users can leave groups, report a member or group, raise tickets, and review their own tickets and reports.

## User flows

The sidebar now includes Study Groups, Raise a ticket, and Review tickets/reports. The Study Groups home screen loads the user’s memberships cache-first, supports bounded public search, and links to group creation or invite-token joining. The group detail screen displays live `Studying`, `Paused`, and `Offline` states, today’s genuine study time, group total, rules, icon selection, group-session start, requests, leave, invite sharing, and reporting. Reports use MCQ reasons plus an optional “Tell us more” field and show an animated thank-you confirmation after submission.

## Verification

The complete regression suite passed with 59 tests. TypeScript compilation, Expo lint, diff validation, and a clean Expo web export passed. The web export contains the new Study Groups, create, join, detail, owner moderation, raise-ticket, and review-tickets routes without the previous nested-route warning. Production verification confirmed all seven new public tables have RLS enabled and the expected policies, and the Study Groups RPCs are SECURITY DEFINER with authenticated execution grants.

No paid services, new storage buckets, external APIs, credentials, or background paid workers were added. Password protection settings were not changed.
