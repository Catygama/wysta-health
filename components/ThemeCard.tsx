import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { fonts } from '@/lib/fonts';
import { Icon, type IconName } from '@/components/ui/Icon';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: IconName; hint: string }[] = [
  {
    value: 'system',
    label: 'Sistema',
    icon: { sf: 'iphone', ion: 'phone-portrait-outline' },
    hint: 'Segue o tema do teu dispositivo.',
  },
  {
    value: 'light',
    label: 'Claro',
    icon: { sf: 'sun.max', ion: 'sunny-outline' },
    hint: 'Usa sempre o tema claro.',
  },
  {
    value: 'dark',
    label: 'Escuro',
    icon: { sf: 'moon', ion: 'moon-outline' },
    hint: 'Usa sempre o tema escuro.',
  },
];

// Light/dark/system picker shown on every profile screen: three equal
// buttons side by side, with one line explaining the chosen one.
export function ThemeCard() {
  const { mode, setMode } = useTheme();
  const { theme } = useUnistyles();
  const current = THEME_OPTIONS.find((o) => o.value === mode) ?? THEME_OPTIONS[0];
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tema</Text>
      <View style={styles.row}>
        {THEME_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          const color = active ? theme.colors.onInk : theme.colors.textPrimary;
          return (
            <Pressable
              key={opt.value}
              testID={`theme-mode-${opt.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setMode(opt.value)}
              style={({ pressed }) => [styles.option, active ? styles.on : styles.off, pressed && styles.pressed]}
            >
              <Icon name={opt.icon} size={18} color={color} />
              <Text style={[styles.label, { color }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{current.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  on: { backgroundColor: theme.colors.ink, borderWidth: 1.5, borderColor: theme.colors.ink },
  off: { borderWidth: 1.5, borderColor: theme.colors.border },
  pressed: { opacity: 0.8 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 13, color: theme.colors.textSecondary },
}));
