import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Fill when active (e.g. a priority colour); defaults to ink. */
  accentColor?: string;
  testID?: string;
};

export function FilterChip({ label, active, onPress, accentColor, testID }: Props) {
  const { theme } = useUnistyles();
  const activeBg = accentColor ?? theme.colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      hitSlop={6}
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: activeBg } : styles.chipIdle]}
    >
      <Text
        style={[
          styles.text,
          active ? styles.textOn : styles.textOff,
          // Priority fills are light in dark mode; onDanger flips to dark text there.
          active && accentColor ? { color: theme.colors.onDanger } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
  },
  chipIdle: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  text: { fontSize: 14, fontWeight: '500' },
  textOn: { color: theme.colors.onInk },
  textOff: { color: theme.colors.textPrimary },
}));
