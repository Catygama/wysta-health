import { Pressable, Text, ActivityIndicator, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native-unistyles';
import { fonts } from '@/lib/fonts';

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
  testID,
}: Props) {
  const resolvedKind: Kind = kind ?? variant ?? 'primary';
  const isDisabled = !!(disabled || loading);

  styles.useVariants({ kind: resolvedKind, size });

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
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
  base: {
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      kind: {
        primary: { backgroundColor: theme.colors.ink },
        secondary: { backgroundColor: theme.colors.surfaceSunken },
        danger: { backgroundColor: theme.colors.danger },
        ghost: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.divider,
        },
      },
      size: {
        md: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
        sm: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
      },
    },
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: fonts.displayBold,
    variants: {
      kind: {
        primary: { color: theme.colors.onInk },
        secondary: { color: theme.colors.textPrimary },
        danger: { color: theme.colors.onInk },
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
