import { Pressable, Text, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';

type Kind = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Preferred. */
  kind?: Kind;
  /** Back-compat alias for `kind`. */
  variant?: Kind;
  size?: 'md' | 'sm';
  /** Stronger (50%) outline, for secondary buttons that must stand out. */
  strongBorder?: boolean;
  /** Screen-reader description of the result, when the label alone is ambiguous. */
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  loading,
  disabled,
  kind,
  variant,
  size = 'md',
  strongBorder,
  accessibilityHint,
  testID,
}: Props) {
  const resolvedKind: Kind = kind ?? variant ?? 'primary';
  const isDisabled = !!(disabled || loading);

  styles.useVariants({ kind: resolvedKind, size });

  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      aria-disabled={isDisabled}
      aria-busy={!!loading}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        strongBorder && styles.strongBorder,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  strongBorder: { borderWidth: 1.5, borderColor: theme.colors.borderStrong },
  base: {
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    // Web: ease the press state in and out instead of snapping.
    _web: { transition: 'transform 120ms ease-out, opacity 120ms ease-out' },
    variants: {
      kind: {
        primary: { backgroundColor: theme.colors.ink },
        secondary: {
          backgroundColor: theme.colors.surfaceSunken,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
        },
        danger: { backgroundColor: theme.colors.danger },
        ghost: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.border,
        },
      },
      size: {
        // minHeight keeps the touch target at or above the 44pt platform minimum.
        md: { minHeight: 48, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
        sm: { minHeight: 44, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
      },
    },
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: fonts.displayBold,
    // Centred also when a long label wraps onto two lines.
    textAlign: 'center',
    variants: {
      kind: {
        primary: { color: theme.colors.onInk },
        secondary: { color: theme.colors.textPrimary },
        danger: { color: theme.colors.onDanger },
        ghost: { color: theme.colors.textPrimary },
      },
      size: {
        md: { fontSize: 16 },
        sm: { fontSize: 14 },
      },
    },
  },
  spinner: {},
}));
