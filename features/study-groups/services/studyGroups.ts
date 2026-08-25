import { supabase } from '@/features/core/services/supabase';
import {
  formatStudyDuration,
  normalizeStudyGroupPermissions,
  PRESENCE_STALE_AFTER_MS,
  STUDY_GROUP_ICON_OPTIONS,
  type StudyGroupPermissions,
} from './studyGroupsPolicy';

export {
  canManageStudyGroupMember,
  DEFAULT_STUDY_GROUP_PERMISSIONS,
  formatStudyDuration,
  normalizeStudyGroupPermissions,
  PRESENCE_STALE_AFTER_MS,
  STUDY_GROUP_ICON_OPTIONS,
} from './studyGroupsPolicy';
export type { StudyGroupPermissionKey, StudyGroupPermissions } from './studyGroupsPolicy';

export type StudyGroupIconKey = typeof STUDY_GROUP_ICON_OPTIONS[number]['key'];
export type StudyGroupVisibility = 'private' | 'public';
export type StudyGroupMemberRole = 'owner' | 'admin' | 'member';
export type StudyGroupMemberStatus = 'pending' | 'approved' | 'rejected';
export type StudyGroupPresenceStatus = 'studying' | 'paused' | 'offline';
export type StudyGroupReportReason =
  | 'spam'
  | 'abuse'
  | 'fake_study_time'
  | 'inappropriate_content'
  | 'harassment'
  | 'privacy'
  | 'scam_or_fraud'
  | 'unsafe_or_illegal_content'
  | 'other';
export type StudyGroupReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';
export type StudyGroupTicketCategory = 'bug' | 'account' | 'study_group' | 'report_follow_up' | 'feature_request' | 'other';
export type StudyGroupTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface StudyGroup {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  rules: string;
  targetExam: string;
  dailyGoalMinutes: number;
  maxMembers: number;
  visibility: StudyGroupVisibility;
  iconKey: string;
  joinCode: string;
  memberCount: number;
  createdAt: string;
  suspendedUntil: string | null;
  inviteToken?: string;
}

export interface StudyGroupMember {
  membershipId: string;
  groupId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: StudyGroupMemberRole;
  permissions: StudyGroupPermissions;
  status: StudyGroupMemberStatus;
  iconKey: string;
  presenceStatus: StudyGroupPresenceStatus;
  presenceStartedAt: string | null;
  lastSeenAt: string | null;
  todayMinutes: number;
  joinedAt: string;
  approvedAt: string | null;
}

export interface StudyGroupMembership {
  membershipId: string;
  groupId: string;
  userId: string;
  role: StudyGroupMemberRole;
  permissions: StudyGroupPermissions;
  status: StudyGroupMemberStatus;
  iconKey: string;
  joinedAt: string;
  approvedAt: string | null;
}

export interface StudyGroupPendingMember {
  membershipId: string;
  userId: string;
  name: string;
  iconKey: string;
  createdAt: string;
}

export interface StudyGroupReport {
  id: string;
  groupId: string | null;
  reporterId: string;
  reportedUserId: string | null;
  reasonCode: StudyGroupReportReason;
  details: string;
  status: StudyGroupReportStatus;
  resolution: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface StudyGroupTicket {
  id: string;
  userId: string;
  groupId: string | null;
  reportId: string | null;
  category: StudyGroupTicketCategory;
  subject: string;
  details: string;
  status: StudyGroupTicketStatus;
  resolution: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CreateStudyGroupInput {
  name: string;
  description?: string;
  rules?: string;
  targetExam?: string;
  dailyGoalMinutes?: number;
  maxMembers?: number;
  visibility?: StudyGroupVisibility;
  iconKey?: string;
}

export interface CreateStudyGroupResult extends StudyGroup {
  inviteToken: string;
}

function throwIfError(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || 'Study Group request failed.');
}

function mapGroup(row: any): StudyGroup {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id ?? ''),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    rules: String(row.rules ?? ''),
    targetExam: String(row.target_exam ?? 'OTHER'),
    dailyGoalMinutes: Number(row.daily_goal_minutes ?? 120),
    maxMembers: Number(row.max_members ?? 12),
    visibility: row.visibility === 'public' ? 'public' : 'private',
    iconKey: String(row.icon_key ?? 'books'),
    joinCode: String(row.join_code ?? ''),
    memberCount: Number(row.member_count ?? 0),
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
    suspendedUntil: row.suspended_until ? String(row.suspended_until) : null,
    ...(row.invite_token ? { inviteToken: String(row.invite_token) } : {}),
  };
}

function mapMembership(row: any): StudyGroupMembership {
  return {
    membershipId: String(row.id),
    groupId: String(row.group_id),
    userId: String(row.user_id),
    role: row.role === 'owner' || row.role === 'admin' ? row.role : 'member',
    permissions: normalizeStudyGroupPermissions(row.permissions),
    status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending',
    iconKey: String(row.icon_key ?? 'books'),
    joinedAt: String(row.joined_at ?? row.created_at ?? new Date(0).toISOString()),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
  };
}

function mapMember(row: any, now = Date.now()): StudyGroupMember {
  const rawStatus = row.presence_status === 'studying' || row.presence_status === 'paused'
    ? row.presence_status
    : 'offline';
  const lastSeenAt = row.last_seen_at ? String(row.last_seen_at) : null;
  const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : 0;
  const presenceStatus: StudyGroupPresenceStatus =
    rawStatus !== 'offline' && lastSeenMs > 0 && now - lastSeenMs <= PRESENCE_STALE_AFTER_MS
      ? rawStatus
      : 'offline';
  return {
    membershipId: String(row.membership_id ?? row.id),
    groupId: String(row.group_id ?? ''),
    userId: String(row.user_id),
    name: String(row.name ?? 'Student'),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    role: row.role === 'owner' || row.role === 'admin' ? row.role : 'member',
    permissions: normalizeStudyGroupPermissions(row.permissions),
    status: 'approved',
    iconKey: String(row.icon_key ?? 'books'),
    presenceStatus,
    presenceStartedAt: row.presence_started_at ? String(row.presence_started_at) : null,
    lastSeenAt,
    todayMinutes: Number(row.today_minutes ?? 0),
    joinedAt: String(row.joined_at ?? new Date(0).toISOString()),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
  };
}

function mapReport(row: any): StudyGroupReport {
  return {
    id: String(row.id),
    groupId: row.group_id ? String(row.group_id) : null,
    reporterId: String(row.reporter_id),
    reportedUserId: row.reported_user_id ? String(row.reported_user_id) : null,
    reasonCode: String(row.reason_code) as StudyGroupReportReason,
    details: String(row.details ?? ''),
    status: String(row.status ?? 'pending') as StudyGroupReportStatus,
    resolution: String(row.resolution ?? ''),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
  };
}

function mapTicket(row: any): StudyGroupTicket {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    groupId: row.group_id ? String(row.group_id) : null,
    reportId: row.report_id ? String(row.report_id) : null,
    category: String(row.category) as StudyGroupTicketCategory,
    subject: String(row.subject ?? ''),
    details: String(row.details ?? ''),
    status: String(row.status ?? 'open') as StudyGroupTicketStatus,
    resolution: String(row.resolution ?? ''),
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date(0).toISOString()),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  };
}

export async function createStudyGroup(input: CreateStudyGroupInput): Promise<CreateStudyGroupResult> {
  const { data, error } = await supabase.rpc('create_study_group', {
    p_name: input.name.trim(),
    p_description: input.description?.trim() ?? '',
    p_rules: input.rules?.trim() ?? '',
    p_target_exam: input.targetExam?.trim() || 'OTHER',
    p_daily_goal_minutes: input.dailyGoalMinutes ?? 120,
    p_max_members: input.maxMembers ?? 12,
    p_visibility: input.visibility ?? 'private',
    p_icon_key: input.iconKey ?? 'books',
  });
  throwIfError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('The Study Group was not created.');
  return mapGroup(row) as CreateStudyGroupResult;
}

export async function searchPublicStudyGroups(query = ''): Promise<StudyGroup[]> {
  const { data, error } = await supabase.rpc('get_public_study_groups', {
    p_query: query.trim(),
    p_limit: 30,
  });
  throwIfError(error);
  return (data ?? []).map(mapGroup);
}

export async function getMyStudyGroups(userId: string): Promise<{ group: StudyGroup; membership: StudyGroupMembership }[]> {
  const memberships = await getMyStudyGroupMemberships(userId);
  const groupIds = memberships.map(membership => membership.groupId);
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from('study_groups')
    .select('id,owner_id,name,description,rules,target_exam,daily_goal_minutes,max_members,visibility,icon_key,join_code,created_at,suspended_until')
    .in('id', groupIds)
    .limit(100);
  throwIfError(error);
  const groups = (data ?? []).map(mapGroup);
  const byId = new Map(groups.map(group => [group.id, group]));
  return memberships
    .map(membership => {
      const group = byId.get(membership.groupId);
      return group ? { group, membership } : null;
    })
    .filter((entry): entry is { group: StudyGroup; membership: StudyGroupMembership } => Boolean(entry));
}

export async function getOwnerStudyGroups(): Promise<StudyGroup[]> {
  const { data, error } = await supabase
    .from('study_groups')
    .select('id,owner_id,name,description,rules,target_exam,daily_goal_minutes,max_members,visibility,icon_key,join_code,created_at,suspended_until')
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map(mapGroup);
}

export async function getStudyGroup(groupId: string): Promise<StudyGroup | null> {
  const { data, error } = await supabase
    .from('study_groups')
    .select('id,owner_id,name,description,rules,target_exam,daily_goal_minutes,max_members,visibility,icon_key,join_code,created_at,suspended_until')
    .eq('id', groupId)
    .maybeSingle();
  throwIfError(error);
  return data ? mapGroup(data) : null;
}

export async function getStudyGroupByInvite(token: string): Promise<StudyGroup | null> {
  const { data, error } = await supabase.rpc('get_study_group_by_invite', { p_token: token.trim() });
  throwIfError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapGroup(row) : null;
}

export async function getMyStudyGroupMemberships(userId: string): Promise<StudyGroupMembership[]> {
  const { data, error } = await supabase.rpc('get_my_study_group_memberships');
  throwIfError(error);
  return (data ?? [])
    .filter((row: any) => String(row.user_id) === userId)
    .map(mapMembership);
}

export async function joinStudyGroup(groupId: string, inviteToken?: string | null): Promise<StudyGroupMemberStatus> {
  const { data, error } = await supabase.rpc('join_study_group', {
    p_group_id: groupId,
    p_invite_token: inviteToken?.trim() || null,
  });
  throwIfError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not join this Study Group.');
  return String(row.status) as StudyGroupMemberStatus;
}

export async function getStudyGroupMembers(groupId: string): Promise<StudyGroupMember[]> {
  const { data, error } = await supabase.rpc('get_study_group_members', { p_group_id: groupId });
  throwIfError(error);
  return (data ?? []).map((row: any) => mapMember({ ...row, group_id: groupId }));
}

export async function getPendingStudyGroupMembers(groupId: string): Promise<StudyGroupPendingMember[]> {
  const { data, error } = await supabase.rpc('get_pending_study_group_members', { p_group_id: groupId });
  throwIfError(error);
  return (data ?? []).map((row: any) => ({
    membershipId: String(row.membership_id),
    userId: String(row.user_id),
    name: String(row.name ?? 'Student'),
    iconKey: String(row.icon_key ?? 'books'),
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
  }));
}

export async function reviewStudyGroupMember(membershipId: string, status: 'approved' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('review_study_group_member', {
    p_membership_id: membershipId,
    p_status: status,
  });
  throwIfError(error);
}

export async function updateStudyGroupDetails(input: {
  groupId: string;
  name: string;
  description: string;
  rules: string;
  targetExam: string;
  dailyGoalMinutes: number;
  maxMembers: number;
}): Promise<void> {
  const { error } = await supabase.rpc('update_study_group_details', {
    p_group_id: input.groupId,
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_rules: input.rules.trim(),
    p_target_exam: input.targetExam.trim(),
    p_daily_goal_minutes: input.dailyGoalMinutes,
    p_max_members: input.maxMembers,
  });
  throwIfError(error);
}

export async function updateStudyGroupMemberRole(input: {
  membershipId: string;
  role: 'admin' | 'member';
  permissions: StudyGroupPermissions;
}): Promise<void> {
  const { error } = await supabase.rpc('update_study_group_member_role', {
    p_membership_id: input.membershipId,
    p_role: input.role,
    p_permissions: {
      manage_join_requests: input.permissions.manageJoinRequests,
      remove_members: input.permissions.removeMembers,
      manage_invites: input.permissions.manageInvites,
      edit_group: input.permissions.editGroup,
      assign_co_admin: input.permissions.assignCoAdmin,
      edit_co_admin_permissions: input.permissions.editCoAdminPermissions,
      demote_co_admin: input.permissions.demoteCoAdmin,
    },
  });
  throwIfError(error);
}

export async function removeStudyGroupMember(membershipId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_study_group_member', { p_membership_id: membershipId });
  throwIfError(error);
}

export async function updateStudyGroupIcon(groupId: string, iconKey: string): Promise<void> {
  const { error } = await supabase.rpc('update_study_group_icon', {
    p_group_id: groupId,
    p_icon_key: iconKey,
  });
  throwIfError(error);
}

export async function leaveStudyGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_study_group', { p_group_id: groupId });
  throwIfError(error);
}

export async function getStudyGroupInviteToken(groupId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('study_group_invites')
    .select('token')
    .eq('group_id', groupId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data?.token ? String(data.token) : null;
}

export async function createStudyGroupInvite(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_study_group_invite', { p_group_id: groupId });
  throwIfError(error);
  if (!data) throw new Error('Could not create an invite link.');
  return String(data);
}

export async function archiveStudyGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_study_group', { p_group_id: groupId });
  throwIfError(error);
}

export async function suspendStudyGroup(groupId: string, durationMinutes: number): Promise<void> {
  const { data, error } = await supabase.rpc('suspend_study_group', {
    p_group_id: groupId,
    p_duration_minutes: durationMinutes,
  });
  throwIfError(error);
  if (data !== true) throw new Error('You do not have permission to suspend this Study Group.');
}

export async function restoreStudyGroup(groupId: string): Promise<void> {
  const { data, error } = await supabase.rpc('restore_study_group', { p_group_id: groupId });
  throwIfError(error);
  if (data !== true) throw new Error('You do not have permission to restore this Study Group.');
}

export async function deleteStudyGroupPermanently(groupId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_study_group_permanently', { p_group_id: groupId });
  throwIfError(error);
  if (data !== true) throw new Error('You do not have permission to delete this Study Group.');
}

export async function assertStudyGroupActive(groupId: string): Promise<void> {
  const { data, error } = await supabase.rpc('assert_study_group_active', { p_group_id: groupId });
  throwIfError(error);
  if (data !== true) throw new Error('This Study Group is temporarily suspended.');
}

export async function updateStudyGroupPresence(input: {
  groupId: string;
  userId: string;
  sessionId: string | null;
  status: StudyGroupPresenceStatus;
  startedAt?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('update_study_group_presence', {
    p_group_id: input.groupId,
    p_session_id: input.sessionId,
    p_status: input.status,
    p_started_at: input.startedAt ?? null,
  });
  throwIfError(error);
}

export async function clearStudyGroupPresence(groupId: string, _userId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_study_group_presence', { p_group_id: groupId });
  throwIfError(error);
}

export async function submitStudyGroupReport(input: {
  groupId: string;
  inviteToken?: string | null;
  reasonCode: StudyGroupReportReason;
  details?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_study_group_report', {
    p_group_id: input.groupId,
    p_invite_token: input.inviteToken?.trim() || null,
    p_reason_code: input.reasonCode,
    p_details: input.details?.trim() ?? '',
  });
  throwIfError(error);
}

export async function getMyStudyGroupReports(userId: string): Promise<StudyGroupReport[]> {
  const { data, error } = await supabase
    .from('study_group_reports')
    .select('id,group_id,reporter_id,reported_user_id,reason_code,details,status,resolution,reviewed_by,reviewed_at,created_at')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map(mapReport);
}

export async function getOwnerStudyGroupReports(): Promise<StudyGroupReport[]> {
  const { data, error } = await supabase
    .from('study_group_reports')
    .select('id,group_id,reporter_id,reported_user_id,reason_code,details,status,resolution,reviewed_by,reviewed_at,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map(mapReport);
}

export async function getStudyGroupNames(groupIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(groupIds.filter(Boolean))).slice(0, 100);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('study_groups')
    .select('id,name')
    .in('id', ids)
    .limit(100);
  throwIfError(error);
  return Object.fromEntries((data ?? []).map((row: any) => [String(row.id), String(row.name ?? '')]));
}

export async function reviewStudyGroupReport(reportId: string, status: StudyGroupReportStatus, resolution = ''): Promise<void> {
  const { error } = await supabase.rpc('review_study_group_report', {
    p_report_id: reportId,
    p_status: status,
    p_resolution: resolution.trim(),
  });
  throwIfError(error);
}

export async function submitStudyGroupTicket(input: {
  userId: string;
  category: StudyGroupTicketCategory;
  subject: string;
  details: string;
  groupId?: string | null;
  reportId?: string | null;
}): Promise<StudyGroupTicket> {
  const { data, error } = await supabase
    .from('study_group_tickets')
    .insert({
      user_id: input.userId,
      category: input.category,
      subject: input.subject.trim(),
      details: input.details.trim(),
      group_id: input.groupId ?? null,
      report_id: input.reportId ?? null,
    })
    .select('id,user_id,group_id,report_id,category,subject,details,status,resolution,created_at,updated_at,resolved_at')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Could not create the ticket.');
  return mapTicket(data);
}

export async function getMyStudyGroupTickets(userId: string): Promise<StudyGroupTicket[]> {
  const { data, error } = await supabase
    .from('study_group_tickets')
    .select('id,user_id,group_id,report_id,category,subject,details,status,resolution,created_at,updated_at,resolved_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map(mapTicket);
}

export async function getOwnerStudyGroupTickets(): Promise<StudyGroupTicket[]> {
  const { data, error } = await supabase
    .from('study_group_tickets')
    .select('id,user_id,group_id,report_id,category,subject,details,status,resolution,created_at,updated_at,resolved_at')
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map(mapTicket);
}

export async function respondToStudyGroupTicket(input: {
  ticketId: string;
  status: Exclude<StudyGroupTicketStatus, 'open'>;
  resolution: string;
}): Promise<void> {
  const resolution = input.resolution.trim();
  if (resolution.length < 3 || resolution.length > 1000) {
    throw new Error('Ticket response must be between 3 and 1000 characters.');
  }
  const { error } = await supabase.rpc('respond_to_study_group_ticket', {
    p_ticket_id: input.ticketId,
    p_status: input.status,
    p_resolution: resolution,
  });
  throwIfError(error);
}

export async function closeStudyGroupTicket(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('close_study_group_ticket', { p_ticket_id: ticketId });
  throwIfError(error);
}

export function subscribeToStudyGroupTickets(userId: string, owner: boolean, onChange: () => void): () => void {
  const channel = supabase
    .channel(`support-tickets-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'study_group_tickets',
      ...(owner ? {} : { filter: `user_id=eq.${userId}` }),
    }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function isPadhaiOwner(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_admins')
    .select('user_id,role')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle();
  throwIfError(error);
  return Boolean(data);
}

export function subscribeToStudyGroup(groupId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`study-group-${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'study_groups', filter: `id=eq.${groupId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'study_group_members', filter: `group_id=eq.${groupId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'study_group_presence', filter: `group_id=eq.${groupId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'study_group_sessions', filter: `group_id=eq.${groupId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
