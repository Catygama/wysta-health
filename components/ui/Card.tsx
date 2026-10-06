import { Pressable, View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = ViewProps & {
  onPress?: () => void;
  /** Visual emphasis: 'surface' (white) default, 'sunken' (cream inset). */
  tone?: 'surface' | 'sunken';
  padded?: boolean;
  testID?: string;
};

export function Card({
  onPress,
  tone = 'surface',
  padded = true,
  style,
  children,
  testID,
  ...rest
}: Props) {
  styles.useVariants({ tone, padded });

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]} {...rest}>
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
  pressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
}));
