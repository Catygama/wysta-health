import { Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';

// Back button for stack screens reached without a screen beneath them (deep
// links, or router.replace from outside the stack), where the navigator shows
// no back button at all. Goes back when possible, else to `fallback`.
// With `to`, always returns to that screen of the stack instead of the previous
// route: a chat opened from Home then goes back to its list, so the tab doesn't
// keep reopening the same chat.
export function HeaderBack({ fallback, to }: { fallback?: Href; to?: Href }) {
  const router = useRouter();
  const { theme } = useUnistyles();
  return (
    <Pressable
      testID="header-back"
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={8}
      onPress={() => {
        if (to) router.dismissTo(to);
        else if (router.canGoBack()) router.back();
        else if (fallback) router.replace(fallback);
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={{ sf: 'chevron.left', ion: 'chevron-back' }} size={24} color={theme.colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create(() => ({
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  pressed: { opacity: 0.6 },
}));
