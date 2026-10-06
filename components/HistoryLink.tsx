import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';

// Profile entry point to the closed-conversations history.
export function HistoryLink({ onPress }: { onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      testID="profile-history-link"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Icon
        name={{ sf: 'clock.arrow.circlepath', ion: 'time-outline' }}
        size={20}
        color={theme.colors.ink}
      />
      <View style={styles.body}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={styles.sub}>Conversas terminadas</Text>
      </View>
      <Icon
        name={{ sf: 'chevron.right', ion: 'chevron-forward' }}
        size={16}
        color={theme.colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textSecondary },
}));
