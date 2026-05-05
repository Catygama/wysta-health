import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import {
  lightColors,
  darkColors,
  type Colors,
} from '@/constants/theme';
import { prefStorage } from '@/lib/prefStorage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'wysta-theme-mode';
const VALID_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'] as const;

type ThemeContextValue = {
  mode: ThemeMode;
  effective: EffectiveTheme;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveEffective(
  mode: ThemeMode,
  systemScheme: ColorSchemeName | null,
): EffectiveTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName | null>(
    () => Appearance.getColorScheme() ?? null,
  );

  // Hydrate stored preference once on mount. We intentionally don't block
  // render — first paint uses 'system' which is the right default anyway.
  useEffect(() => {
    let cancelled = false;
    prefStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored && (VALID_MODES as readonly string[]).includes(stored)) {
        setModeState(stored as ThemeMode);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to OS-level appearance changes so 'system' reacts live.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    prefStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Best-effort persistence; ignore failures (e.g. private-mode storage).
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const effective = resolveEffective(mode, systemScheme);
    return {
      mode,
      effective,
      colors: effective === 'dark' ? darkColors : lightColors,
      setMode,
    };
  }, [mode, systemScheme, setMode]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for code paths rendered before the provider mounts (very
    // early errors, root-level fallback). Returns the light palette and a
    // no-op setter so callers don't crash.
    return {
      mode: 'system',
      effective: 'light',
      colors: lightColors,
      setMode: () => {},
    };
  }
  return ctx;
}
