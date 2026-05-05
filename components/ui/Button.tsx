import { Pressable, Text, ActivityIndicator } from 'react-native';
import { spacing, radius, typography } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  testID?: string;
};

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  testID,
}: Props) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : colors.background.tertiary;
  const fg =
    variant === 'secondary' ? colors.text.primary : colors.text.inverse;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: bg,
        opacity: pressed || disabled ? 0.7 : 1,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ ...typography.base, fontWeight: '600', color: fg }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
