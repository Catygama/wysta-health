import type { ReactElement } from 'react';
import { Platform } from 'react-native';
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

// Custom header buttons. On iOS 26 the system wraps custom bar items in a
// shared liquid-glass capsule that ignores the app theme: light glass behind
// our dark-mode header, with the light text on it nearly invisible. Pass them
// as custom items with that background hidden; the buttons draw their own
// (components/ui/HeaderBack, the screens' header actions). Elsewhere these are
// the plain headerLeft / headerRight.
export function headerItems(items: {
  left?: () => ReactElement;
  right?: () => ReactElement;
}) {
  // Only the sides passed in: a screen's options merge over its layout's, so
  // an absent side keeps the layout's button, while passing undefined
  // removes it (e.g. a closed conversation has no actions).
  const hasLeft = 'left' in items;
  const hasRight = 'right' in items;
  const { left, right } = items;
  if (Platform.OS !== 'ios') {
    return {
      ...(hasLeft ? { headerLeft: left } : {}),
      ...(hasRight ? { headerRight: right } : {}),
    };
  }
  const item = (render: () => ReactElement) => () => [
    { type: 'custom' as const, element: render(), hidesSharedBackground: true },
  ];
  return {
    // Unlike headerLeft, left items don't replace the system back button.
    ...(hasLeft ? { headerBackVisible: !left, unstable_headerLeftItems: left ? item(left) : undefined } : {}),
    ...(hasRight ? { unstable_headerRightItems: right ? item(right) : undefined } : {}),
  };
}
