import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { getItem, setItem, StorageKeys } from '@/features/core/services/storage';

export type FocusGuardStatus = {
  available: boolean;
  overlay: boolean;
  usageStats: boolean;
  enabled: boolean;
};

type NativeFocusGuard = {
  getStatus(): FocusGuardStatus;
  configure(blockedPackages: string[], allowedPackages: string[]): void;
  start(): boolean;
  stop(): void;
  consumeBreakRequest(): boolean;
  openOverlaySettings(): void;
  openUsageStatsSettings(): void;
};

let nativeFocusGuard: NativeFocusGuard | null | undefined;

function getNativeFocusGuard(): NativeFocusGuard | null {
  if (Platform.OS !== 'android') return null;
  if (nativeFocusGuard !== undefined) return nativeFocusGuard;
  try {
    nativeFocusGuard = requireOptionalNativeModule<NativeFocusGuard>('PadhAIFocusGuard');
  } catch {
    nativeFocusGuard = null;
  }
  return nativeFocusGuard;
}

export const YOUTUBE_PACKAGE = 'com.google.android.youtube';
export const DEFAULT_BLOCKED_PACKAGES = [YOUTUBE_PACKAGE];
export const DEFAULT_ALLOWED_PACKAGES = [
  'com.padhai.app',
  'com.pw.live',
  'com.unacademyapp',
  'com.allen',
  'org.khanacademy.android',
  'com.google.android.apps.classroom',
];

export function isAndroidFocusGuardAvailable(): boolean {
  return Platform.OS === 'android' && getNativeFocusGuard() !== null;
}

export function getFallbackStatus(): FocusGuardStatus {
  return {
    available: isAndroidFocusGuardAvailable(),
    overlay: false,
    usageStats: false,
    enabled: false,
  };
}

export function getFocusGuardStatus(): FocusGuardStatus {
  if (!isAndroidFocusGuardAvailable()) return getFallbackStatus();
  try {
    return getNativeFocusGuard()?.getStatus() ?? getFallbackStatus();
  } catch {
    return getFallbackStatus();
  }
}

export async function getApprovedStudyApps(): Promise<string[]> {
  const saved = await getItem<string[]>(StorageKeys.FOCUS_GUARD_ALLOWED_APPS);
  return Array.from(new Set([
    ...DEFAULT_ALLOWED_PACKAGES,
    ...(Array.isArray(saved) ? saved : []),
  ]));
}

export async function saveApprovedStudyApps(packageNames: string[]): Promise<void> {
  const cleaned = Array.from(new Set(packageNames.filter(value => /^[A-Za-z][A-Za-z0-9_.]+$/.test(value))));
  await setItem(StorageKeys.FOCUS_GUARD_ALLOWED_APPS, cleaned);
  if (isAndroidFocusGuardAvailable()) {
    getNativeFocusGuard()?.configure(DEFAULT_BLOCKED_PACKAGES, ['com.padhai.app', ...cleaned]);
  }
}

export async function startFocusGuard(): Promise<FocusGuardStatus> {
  if (!isAndroidFocusGuardAvailable()) return getFallbackStatus();
  const approved = await getApprovedStudyApps();
  try {
    getNativeFocusGuard()?.configure(DEFAULT_BLOCKED_PACKAGES, ['com.padhai.app', ...approved]);
    const started = getNativeFocusGuard()?.start() ?? false;
    return { ...getFocusGuardStatus(), enabled: started };
  } catch {
    return getFocusGuardStatus();
  }
}

export function stopFocusGuard(): void {
  try {
    getNativeFocusGuard()?.stop();
  } catch {}
}

export function consumeFocusBreakRequest(): boolean {
  try {
    return Boolean(getNativeFocusGuard()?.consumeBreakRequest());
  } catch {
    return false;
  }
}

export function openOverlayPermissionSettings(): void {
  try {
    getNativeFocusGuard()?.openOverlaySettings();
  } catch {}
}

export function openUsageStatsPermissionSettings(): void {
  try {
    getNativeFocusGuard()?.openUsageStatsSettings();
  } catch {}
}
