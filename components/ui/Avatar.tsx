import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  initials: string;
  size?: number;
  tone?: 'lilac' | 'mint' | 'ink';
  /** Person's name to announce; without it the avatar is decorative. */
  accessibilityLabel?: string;
  testID?: string;
};

export function Avatar({ initials, size = 40, tone = 'lilac', accessibilityLabel, testID }: Props) {
  styles.useVariants({ tone });
  return (
    <View
      testID={testID}
      {...(accessibilityLabel
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
        : { 'aria-hidden': true })}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    variants: {
      tone: {
        lilac: { backgroundColor: theme.colors.butter },
        mint: { backgroundColor: theme.topic.intimate.fill },
        ink: { backgroundColor: theme.colors.ink },
      },
    },
  },
  text: {
    fontWeight: '500',
    variants: {
      tone: {
        lilac: { color: theme.colors.inkText },
        mint: { color: theme.topic.intimate.on },
        ink: { color: theme.colors.onInk },
      },
    },
  },
}));
