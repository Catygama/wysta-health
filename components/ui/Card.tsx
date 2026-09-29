import { Pressable, View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = ViewProps & {
  onPress?: () => void;
  /** Visual emphasis: 'surface' (white) default, 'sunken' (cream inset). */
  tone?: 'surface' | 'sunken';
  padded?: boolean;
  /** Spoken name when pressable; defaults to the concatenated child text. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function Card({
  onPress,
  tone = 'surface',
  padded = true,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  testID,
  ...rest
}: Props) {
  styles.useVariants({ tone, padded });

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.card, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    variants: {
      tone: {
        surface: { backgroundColor: theme.colors.surface },
        sunken: { backgroundColor: theme.colors.surfaceSunken },
      },
      padded: {
        true: { padding: theme.spacing.md },
        false: {},
      },
    },
  },
  pressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
}));
