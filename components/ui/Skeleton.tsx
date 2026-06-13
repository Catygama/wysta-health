import { useEffect } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  testID?: string;
};

export function Skeleton({ width = '100%', height = 16, radius = 8, testID }: Props) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      style={[styles.base, { width, height, borderRadius: radius }, animated]}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { backgroundColor: theme.colors.surfaceSunken },
}));
