export const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_OUTPUT_BYTES = 200 * 1024;
export const AVATAR_MAX_DIMENSION = 512;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
