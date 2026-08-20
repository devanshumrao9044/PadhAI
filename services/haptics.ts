import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supportsHaptics = Platform.OS === 'android' || Platform.OS === 'ios';

async function safely(run: () => Promise<void>): Promise<void> {
  if (!supportsHaptics) return;
  try {
    await run();
  } catch {
    // Haptics are optional feedback and must never interrupt app behavior.
  }
}

export const haptics = {
  tabSwitch: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  xpGain: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  streakMilestone: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  focusComplete: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  focusBroken: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
