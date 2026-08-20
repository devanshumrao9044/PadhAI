export const PRESENCE_STALE_AFTER_MS = 90_000;

export const STUDY_GROUP_PERMISSION_KEYS = [
  'manageJoinRequests',
  'removeMembers',
  'manageInvites',
  'editGroup',
  'assignCoAdmin',
  'editCoAdminPermissions',
  'demoteCoAdmin',
] as const;

export type StudyGroupPermissionKey = typeof STUDY_GROUP_PERMISSION_KEYS[number];
export type StudyGroupRole = 'owner' | 'admin' | 'member';
export type StudyGroupMemberAction = 'promote' | 'editPermissions' | 'demote' | 'remove';
export type StudyGroupPermissions = Record<StudyGroupPermissionKey, boolean>;

export const DEFAULT_STUDY_GROUP_PERMISSIONS: StudyGroupPermissions = {
  manageJoinRequests: false,
  removeMembers: true,
  manageInvites: true,
  editGroup: true,
  assignCoAdmin: true,
  editCoAdminPermissions: true,
  demoteCoAdmin: true,
};

const PERMISSION_DB_KEYS: Record<StudyGroupPermissionKey, string> = {
  manageJoinRequests: 'manage_join_requests',
  removeMembers: 'remove_members',
  manageInvites: 'manage_invites',
  editGroup: 'edit_group',
  assignCoAdmin: 'assign_co_admin',
  editCoAdminPermissions: 'edit_co_admin_permissions',
  demoteCoAdmin: 'demote_co_admin',
};

export function normalizeStudyGroupPermissions(value: unknown): StudyGroupPermissions {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return STUDY_GROUP_PERMISSION_KEYS.reduce((permissions, key) => {
    const rawValue = source[key] ?? source[PERMISSION_DB_KEYS[key]];
    permissions[key] = typeof rawValue === 'boolean'
      ? rawValue
      : DEFAULT_STUDY_GROUP_PERMISSIONS[key];
    return permissions;
  }, {} as StudyGroupPermissions);
}

export function canManageStudyGroupMember(
  actorRole: StudyGroupRole,
  targetRole: StudyGroupRole,
  action: StudyGroupMemberAction,
  hasPermission: boolean,
): boolean {
  if (!hasPermission || targetRole === 'owner' || actorRole === 'member') return false;
  if (actorRole === 'owner') return true;
  if (targetRole === 'admin') return action === 'editPermissions' || action === 'demote' || action === 'remove';
  return action === 'promote' || action === 'remove';
}

export const STUDY_GROUP_ICON_OPTIONS = [
  { key: 'books', icon: 'menu-book' },
  { key: 'lamp', icon: 'lightbulb' },
  { key: 'desk', icon: 'desk' },
  { key: 'phone', icon: 'smartphone' },
  { key: 'target', icon: 'track-changes' },
  { key: 'rocket', icon: 'rocket-launch' },
  { key: 'science', icon: 'science' },
  { key: 'code', icon: 'code' },
] as const;

export function formatStudyDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
