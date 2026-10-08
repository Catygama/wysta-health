import * as Haptics from 'expo-haptics';

// Light physical feedback for taps. Native: expo-haptics. Web: haptics.web.ts.
// Fire-and-forget; devices without haptics just ignore it.
export const haptics = {
  /** A button or card was pressed. */
  tap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** An option was chosen (triage answers, pickers). */
  select: () => {
    Haptics.selectionAsync().catch(() => {});
  },
};
