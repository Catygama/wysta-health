import { Pressable, View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { haptics } from '@/lib/haptics';

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
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        style={({ pressed }) => [styles.card, styles.pressable, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      // A label needs a role on the web (aria-prohibited-attr): group it.
      accessibilityRole={accessibilityLabel ? 'summary' : undefined}
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
        // Hairline keeps white cards distinct on the near-white page.
        surface: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        sunken: { backgroundColor: theme.colors.surfaceSunken },
      },
      padded: {
        true: { padding: theme.spacing.md },
        false: {},
      },
    },
  },
  pressable: { _web: { transition: 'transform 120ms ease-out, opacity 120ms ease-out' } },
  // Enough to see under a finger on a phone; 0.99 was imperceptible.
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
}));
