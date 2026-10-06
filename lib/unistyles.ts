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
  contraception: { fill: '#C98F99', on: '#3F000A' },
  cycle: { fill: '#F2C9D0', on: '#6B1A2A' },
  intimate: { fill: '#E6D3E3', on: '#5B2350' },
  pregnancy: { fill: '#F5D6C8', on: '#7A3A24' },
  general: { fill: '#E6D5CC', on: '#4A2E25' },
  wellbeing: { fill: '#E9C2B4', on: '#6B2A1A' },
} as const;

const topicsDark = {
  contraception: { fill: '#6A2A36', on: '#F0C9D0' },
  cycle: { fill: '#5C1E2C', on: '#F2C9D0' },
  intimate: { fill: '#4A2A44', on: '#E6D3E3' },
  pregnancy: { fill: '#5A3226', on: '#F5D6C8' },
  general: { fill: '#3E2C26', on: '#E6D5CC' },
  wellbeing: { fill: '#5A2A1E', on: '#E9C2B4' },
} as const;

// Brand palette: maroon #50000D, dusty pink #E3C7C7, beige #EFDCD6.
// Light theme keeps a near-white page so cards stand out; beige and dusty pink
// are details (sunken areas, icon circles). Other values are tints/shades of
// these three (e.g. a mid red-brown for link text, for contrast).
const lightTheme = {
  ...shared,
  name: 'light',
  colors: {
    ink: '#50000D',
    // Brand color for text/icons. `ink` is a fill (buttons, avatars) and is
    // near-invisible as text on the dark background, so text uses this.
    inkText: '#50000D',
    inkPressed: '#3B000A',
    onInk: '#FBF7F4',
    accent: '#8A3A3A',
    // Brand pink tint used as a fill (icon circles, avatars, tags); pair with inkText.
    butter: '#E3C7C7',
    background: '#FBF7F4',
    surface: '#FFFFFF',
    surfaceSunken: '#F3E6E1',
    textPrimary: '#50000D',
    textSecondary: '#7A5450',
    // Dark enough for WCAG AA (4.5:1) on background/sunken; it's used for
    // placeholders and timestamps, which are text too.
    textTertiary: '#7F5F5B',
    danger: '#C22144',
    // Text on a danger fill: white in light mode; dark in dark mode, where
    // danger is a light pink (white on it is 2.4:1).
    onDanger: '#FFFFFF',
    dangerLight: '#F8DBE2',
    warning: '#9B5F0F',
    warningSurface: '#FBEFD9',
    success: '#1E6B56',
    divider: 'rgba(64,1,1,0.10)',
    // Visible outline for inputs and secondary/outline buttons (a divider is too
    // faint to delimit a control, especially in dark mode).
    border: 'rgba(80,0,13,0.22)',
    borderStrong: 'rgba(80,0,13,0.5)',
  },
  topic: topicsLight,
} as const;

const darkTheme = {
  ...shared,
  name: 'dark',
  colors: {
    ink: '#E3C7C7',
    inkText: '#E3C7C7',
    inkPressed: '#D4B3B3',
    onInk: '#50000D',
    accent: '#EFB9B0',
    butter: '#5A2020',
    background: '#2A0006',
    surface: '#3D000A',
    surfaceSunken: '#330008',
    textPrimary: '#EFDCD6',
    textSecondary: '#CFAFAA',
    // AA (4.5:1) on the dark background.
    textTertiary: '#A88480',
    danger: '#F2879E',
    onDanger: '#2A0006',
    dangerLight: '#3A1822',
    warning: '#E0AE5C',
    warningSurface: '#3A2E16',
    success: '#6FC8AC',
    divider: 'rgba(239,220,214,0.12)',
    border: 'rgba(239,220,214,0.30)',
    borderStrong: 'rgba(239,220,214,0.5)',
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
