import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type FocusGuardStatus = {
  available: boolean;
  overlay: boolean;
  usageStats: boolean;
  enabled: boolean;
};

export type InstalledFocusApp = {
  packageName: string;
  label: string;
  allowed: boolean;
  category: string;
  reason: string;
};

export const focusGuardSetupKey = (userId: string): string => `padhai:focus-guard-setup-v1:${userId}`;

type NativeFocusGuard = {
  getStatus(): FocusGuardStatus;
  configure(blockedPackages: string[], allowedPackages: string[]): void;
  start(): boolean;
  stop(): void;
  consumeBreakRequest(): boolean;
  getInstalledApps(): InstalledFocusApp[];
  refreshAppDecisionCache(): boolean;
  launchStudyApp(packageName: string): boolean;
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

export const HARD_BLOCKED_PACKAGES = [
  YOUTUBE_PACKAGE,
  'com.instagram.android',
  'com.facebook.katana',
  'com.facebook.orca',
  'com.whatsapp',
  'com.snapchat.android',
  'com.twitter.android',
  'com.google.android.apps.youtube.music',
  'com.google.android.apps.youtube.kids',
  'com.google.android.apps.playstore',
  'com.android.vending',
  'com.samsung.android.galaxy.store',
  'com.sec.android.app.samsungapps',
  'com.google.android.packageinstaller',
  'com.android.packageinstaller',
  // Common game packages; native category and pattern checks cover additional games.
  'com.pubg.imobile',
  'com.tencent.ig',
  'com.dts.freefireth',
  'com.dts.freefiremax',
  'com.supercell.clashofclans',
  'com.supercell.brawlstars',
  'com.activision.callofduty.shooter',
  'com.garena.game.codm',
  'com.roblox.client',
  'com.mobile.legends',
  'com.ea.gp.fifamobile',
  'com.kiloo.subwaysurf',
];

export const DEFAULT_BLOCKED_PACKAGES = HARD_BLOCKED_PACKAGES;

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

export async function startFocusGuard(): Promise<FocusGuardStatus> {
  if (!isAndroidFocusGuardAvailable()) return getFallbackStatus();
  try {
    // Native Android performs the complete zero-trust decision. The second
    // argument is intentionally empty so no user-managed allowlist exists.
    getNativeFocusGuard()?.configure(DEFAULT_BLOCKED_PACKAGES, []);
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

export function refreshFocusGuardAppDecisionCache(): boolean {
  if (!isAndroidFocusGuardAvailable()) return false;
  try {
    return Boolean(getNativeFocusGuard()?.refreshAppDecisionCache());
  } catch {
    return false;
  }
}

export function getInstalledApps(): InstalledFocusApp[] {
  if (!isAndroidFocusGuardAvailable()) return [];
  try {
    return (getNativeFocusGuard()?.getInstalledApps() ?? [])
      .filter(app => app && typeof app.packageName === 'string' && typeof app.label === 'string')
      .map(app => ({
        packageName: app.packageName,
        label: app.label,
        allowed: app.allowed === true,
        category: app.category || 'Uncategorized',
        reason: app.reason ?? 'unknown_category',
      }));
  } catch {
    return [];
  }
}

export function launchStudyApp(packageName: string): boolean {
  if (!isAndroidFocusGuardAvailable() || isHardBlockedPackage(packageName)) return false;
  try {
    return Boolean(getNativeFocusGuard()?.launchStudyApp(packageName));
  } catch {
    return false;
  }
}

export function isHardBlockedPackage(packageName: string): boolean {
  return HARD_BLOCKED_PACKAGES.includes(packageName);
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
