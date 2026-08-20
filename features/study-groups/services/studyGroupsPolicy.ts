export const PRESENCE_STALE_AFTER_MS = 90_000;

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
