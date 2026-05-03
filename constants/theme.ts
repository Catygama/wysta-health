import { Platform, PlatformColor } from 'react-native';

// PlatformColor is only called on iOS — safely skipped on web/Android
const ios = (name: string, fallback: string) =>
  Platform.OS === 'ios' ? PlatformColor(name) : fallback;

export const colors = {
  primary: '#7C3AED',
  primaryLight: ios('systemFill', '#EDE9FE'),
  primaryDark: '#5B21B6',

  danger: ios('systemRed', '#DC2626'),
  dangerLight: ios('systemFill', '#FEE2E2'),
  warning: ios('systemOrange', '#D97706'),
  warningLight: ios('secondarySystemFill', '#FEF3C7'),
  success: ios('systemGreen', '#059669'),
  successLight: ios('tertiarySystemFill', '#D1FAE5'),

  text: {
    primary: ios('label', '#111827'),
    secondary: ios('secondaryLabel', '#6B7280'),
    tertiary: ios('tertiaryLabel', '#9CA3AF'),
    inverse: '#FFFFFF',
  },

  background: {
    primary: ios('systemBackground', '#FFFFFF'),
    secondary: ios('secondarySystemBackground', '#F9FAFB'),
    tertiary: ios('tertiarySystemBackground', '#F3F4F6'),
    grouped: ios('systemGroupedBackground', '#F9FAFB'),
    groupedSecondary: ios('secondarySystemGroupedBackground', '#FFFFFF'),
  },

  border: ios('separator', '#E5E7EB'),
  borderOpaque: ios('opaqueSeparator', '#D1D5DB'),
};

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
