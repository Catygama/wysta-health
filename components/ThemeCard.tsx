import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { fonts } from '@/lib/fonts';

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'system', label: 'Sistema', description: 'Segue o tema do dispositivo' },
  { value: 'light', label: 'Claro', description: 'Forçar tema claro' },
  { value: 'dark', label: 'Escuro', description: 'Forçar tema escuro' },
];

// Light/dark/system picker shown on every profile screen.
export function ThemeCard() {
  const { mode, setMode } = useTheme();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tema</Text>
      <View style={styles.list}>
        {THEME_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              testID={`theme-mode-${opt.value}`}
              onPress={() => setMode(opt.value)}
              style={[styles.option, active ? styles.on : styles.off]}
            >
              <Text style={[styles.label, active ? styles.textOn : styles.textOff]}>
                {opt.label}
              </Text>
              <Text style={[styles.desc, active ? styles.descOn : styles.descOff]}>
                {opt.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  list: { gap: theme.spacing.sm },
  option: { padding: theme.spacing.md, borderRadius: theme.radius.md, borderCurve: 'continuous', gap: 2 },
  on: { backgroundColor: theme.colors.ink },
  off: { backgroundColor: theme.colors.surface },
  label: { fontSize: 16, fontWeight: '500' },
  textOn: { color: theme.colors.onInk },
  textOff: { color: theme.colors.textSecondary },
  desc: { fontSize: 12 },
  descOn: { color: theme.colors.onInk, opacity: 0.85 },
  descOff: { color: theme.colors.textSecondary },
}));
