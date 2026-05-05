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

export const lightColors: ColorPalette = {
  primary: '#7C3AED',
  primaryLight: '#EDE9FE',
  primaryDark: '#5B21B6',

  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  success: '#059669',
  successLight: '#D1FAE5',

  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },

  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    grouped: '#F9FAFB',
    groupedSecondary: '#FFFFFF',
  },

  border: '#E5E7EB',
  borderOpaque: '#D1D5DB',
};

export const darkColors: ColorPalette = {
  primary: '#A78BFA',
  primaryLight: '#3B2A66',
  primaryDark: '#C4B5FD',

  danger: '#F87171',
  dangerLight: '#4C1D24',
  warning: '#FBBF24',
  warningLight: '#4A3315',
  success: '#34D399',
  successLight: '#14322A',

  text: {
    primary: '#F9FAFB',
    secondary: '#9CA3AF',
    tertiary: '#6B7280',
    inverse: '#111827',
  },

  background: {
    primary: '#0F172A',
    secondary: '#0B1220',
    tertiary: '#1E293B',
    grouped: '#0B1220',
    groupedSecondary: '#0F172A',
  },

  border: '#1F2937',
  borderOpaque: '#334155',
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
