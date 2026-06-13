// Theme tokens. Two palettes (light / dark) consumed via the useTheme() hook
// in lib/theme.tsx. The static `colors` export aliases the light palette and
// is kept for module-level constants (e.g. STATUS_COLORS in
// constants/conversation.ts) that don't sit inside React components and
// therefore can't subscribe to a hook. Those values are mostly accent shades
// that read fine against either background.

type ColorPalette = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  success: string;
  successLight: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    grouped: string;
    groupedSecondary: string;
  };
  border: string;
  borderOpaque: string;
};

// Ink & pastel palette, mapped onto the legacy ColorPalette shape so every
// existing useTheme() consumer adopts the new look without changes. The new
// canonical tokens live in lib/unistyles.ts; these values are kept in sync by
// hand (primary = ink, warm off-white surfaces, warm text). Screens migrated to
// unistyles should read from the theme there instead of this static palette.
export const lightColors: ColorPalette = {
  primary: '#2E1065',
  primaryLight: '#EDE7FB',
  primaryDark: '#7C3AED',

  danger: '#D7264C',
  dangerLight: '#F8DBE2',
  warning: '#C77B16',
  warningLight: '#FBEFD9',
  success: '#1E6B56',
  successLight: '#DCEFE7',

  text: {
    primary: '#2B2438',
    secondary: '#6E6880',
    tertiary: '#B7B0C6',
    inverse: '#FFFFFF',
  },

  background: {
    primary: '#FBF8F2',
    secondary: '#F4EEE3',
    tertiary: '#ECE3D4',
    grouped: '#F4EEE3',
    groupedSecondary: '#FBF8F2',
  },

  border: '#E7DFD0',
  borderOpaque: '#D8CDB9',
};

export const darkColors: ColorPalette = {
  primary: '#A78BFA',
  primaryLight: '#3B2380',
  primaryDark: '#C4B5FD',

  danger: '#F2879E',
  dangerLight: '#4C1D24',
  warning: '#E0AE5C',
  warningLight: '#3A2E16',
  success: '#6FC8AC',
  successLight: '#14322A',

  text: {
    primary: '#EFEAFB',
    secondary: '#A79FC0',
    tertiary: '#6E6688',
    inverse: '#17112B',
  },

  background: {
    primary: '#221A3A',
    secondary: '#1D1631',
    tertiary: '#2C2348',
    grouped: '#17112B',
    groupedSecondary: '#221A3A',
  },

  border: '#33294F',
  borderOpaque: '#473A66',
};

export const colors: ColorPalette = lightColors;

export type Colors = ColorPalette;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 36 },
};
