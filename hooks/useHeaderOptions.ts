import { useUnistyles } from 'react-native-unistyles';
import { fonts } from '@/lib/fonts';

// Shared native Stack header styling: ink back/tint, Bricolage title to match the
// in-screen headings, cream header + content background. Used by the route-group
// _layout files so navigation chrome stays on the ink & pastel system.
export function useStackHeaderOptions() {
  const { theme } = useUnistyles();
  return {
    headerShown: true,
    headerTintColor: theme.colors.ink as any,
    headerTitleStyle: {
      fontFamily: fonts.displayBold,
      color: theme.colors.textPrimary as any,
    },
    headerStyle: { backgroundColor: theme.colors.background as any },
    contentStyle: { backgroundColor: theme.colors.background as any },
  } as const;
}
