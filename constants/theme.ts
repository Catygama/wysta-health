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
  primary: '#50000D',
  primaryLight: '#E3C7C7',
  primaryDark: '#8A3A3A',

  danger: '#D7264C',
  dangerLight: '#F8DBE2',
  warning: '#C77B16',
  warningLight: '#FBEFD9',
  success: '#1E6B56',
  successLight: '#DCEFE7',

  text: {
    primary: '#50000D',
    secondary: '#6E3A36',
    tertiary: '#A9817C',
    inverse: '#EFDCD6',
  },

  background: {
    primary: '#FAF2EF',
    secondary: '#EFDCD6',
    tertiary: '#E3C7C7',
    grouped: '#EFDCD6',
    groupedSecondary: '#FAF2EF',
  },

  border: '#E3C7C7',
  borderOpaque: '#D3B0AE',
};

export const darkColors: ColorPalette = {
  primary: '#E3C7C7',
  primaryLight: '#50000D',
  primaryDark: '#EFB9B0',

  danger: '#F2879E',
  dangerLight: '#4C1D24',
  warning: '#E0AE5C',
  warningLight: '#3A2E16',
  success: '#6FC8AC',
  successLight: '#14322A',

  text: {
    primary: '#EFDCD6',
    secondary: '#CFAFAA',
    tertiary: '#8E6662',
    inverse: '#50000D',
  },

  background: {
    primary: '#3D000A',
    secondary: '#330008',
    tertiary: '#4D0010',
    grouped: '#2A0006',
    groupedSecondary: '#3D000A',
  },

  border: '#5C0A18',
  borderOpaque: '#701426',
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
