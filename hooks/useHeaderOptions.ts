import { useUnistyles } from 'react-native-unistyles';
import { fonts } from '@/lib/fonts';

// Shared native Stack header styling: back/tint in text color, Bricolage title to match the
// in-screen headings, cream header + content background. Used by the route-group
// _layout files so navigation chrome stays on the ink & pastel system.
export function useStackHeaderOptions() {
  const { theme } = useUnistyles();
  return {
    headerShown: true,
    // textPrimary, not ink: ink is a fill color and is near-invisible on the
    // dark-mode header.
    headerTintColor: theme.colors.textPrimary as any,
    headerTitleStyle: {
      fontFamily: fonts.displayBold,
      color: theme.colors.textPrimary as any,
    },
    headerStyle: { backgroundColor: theme.colors.background as any },
    // The default hairline renders bright white on the dark-mode web header.
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.colors.background as any },
  } as const;
}
