import { StyleSheet } from 'react-native-unistyles';

const shared = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 10, md: 16, lg: 22, xl: 26, pill: 999 },
  // Type scale (sizes only; families/weights applied per-component via fonts.ts).
  text: {
    xs: { fontSize: 12, lineHeight: 16 },
    sm: { fontSize: 14, lineHeight: 20 },
    base: { fontSize: 16, lineHeight: 24 },
    lg: { fontSize: 18, lineHeight: 28 },
    xl: { fontSize: 20, lineHeight: 28 },
    '2xl': { fontSize: 24, lineHeight: 30 },
    '3xl': { fontSize: 30, lineHeight: 34 },
  },
} as const;

// Topic pastels: { fill, on } pairs. `on` is the only legal text color on `fill`.
const topicsLight = {
  contraception: { fill: '#D8CCFC', on: '#2E1065' },
  cycle: { fill: '#FBC4DE', on: '#6B1B43' },
  intimate: { fill: '#A8E8D8', on: '#0B4A3A' },
  pregnancy: { fill: '#FFD2A8', on: '#7A3B0A' },
  general: { fill: '#C9D8FC', on: '#1F2D5C' },
  wellbeing: { fill: '#FBC9BE', on: '#7A2E1E' },
} as const;

const topicsDark = {
  contraception: { fill: '#3B2A6B', on: '#E4DBFB' },
  cycle: { fill: '#5A2342', on: '#FBC4DE' },
  intimate: { fill: '#13463A', on: '#A8E8D8' },
  pregnancy: { fill: '#5A3413', on: '#FFD2A8' },
  general: { fill: '#26345E', on: '#C9D8FC' },
  wellbeing: { fill: '#5A2A1E', on: '#FBC9BE' },
} as const;

const lightTheme = {
  ...shared,
  name: 'light',
  colors: {
    ink: '#2E1065',
    // Brand color for text/icons. `ink` is a fill (buttons, avatars) and is
    // near-invisible as text on the dark background, so text uses this.
    inkText: '#2E1065',
    inkPressed: '#231055',
    onInk: '#FFFFFF',
    accent: '#7C3AED',
    butter: '#FFD978',
    background: '#FAF6EE',
    surface: '#FFFFFF',
    surfaceSunken: '#F3EDE0',
    textPrimary: '#2B2438',
    textSecondary: '#6E6880',
    // Darkened to meet WCAG AA (4.5:1) on background/sunken; it's used for
    // placeholders and timestamps, which are text too.
    textTertiary: '#6E677C',
    danger: '#C22144',
    // Text on a danger fill: white in light mode; dark in dark mode, where
    // danger is a light pink (white on it is 2.4:1).
    onDanger: '#FFFFFF',
    dangerLight: '#F8DBE2',
    warning: '#9B5F0F',
    warningSurface: '#FBEFD9',
    success: '#1E6B56',
    divider: 'rgba(43,36,56,0.08)',
  },
  topic: topicsLight,
} as const;

const darkTheme = {
  ...shared,
  name: 'dark',
  colors: {
    ink: '#3B2380',
    inkText: '#E4DBFB',
    inkPressed: '#321E6E',
    onInk: '#FFFFFF',
    accent: '#A78BFA',
    butter: '#FFD978',
    background: '#17112B',
    surface: '#221A3A',
    surfaceSunken: '#1D1631',
    textPrimary: '#EFEAFB',
    textSecondary: '#A79FC0',
    textTertiary: '#8982A0',
    danger: '#F2879E',
    onDanger: '#17112B',
    dangerLight: '#3A1822',
    warning: '#E0AE5C',
    warningSurface: '#3A2E16',
    success: '#6FC8AC',
    divider: 'rgba(239,234,251,0.10)',
  },
  topic: topicsDark,
} as const;

const breakpoints = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

const appThemes = { light: lightTheme, dark: darkTheme };
type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    // Default mirrors the legacy provider's 'system' default. The legacy
    // ThemeProvider takes over control after hydration (see lib/theme.tsx).
    adaptiveThemes: true,
  },
});
