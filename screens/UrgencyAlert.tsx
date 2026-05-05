import { View, Text, Pressable } from 'react-native';
import { spacing, typography, radius } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { useTheme } from '@/lib/theme';

type Props = {
  onDismiss: () => void;
};

export function UrgencyAlert({ onDismiss }: Props) {
  const { colors } = useTheme();
  return (
    <View
      testID="urgency-alert"
      style={{
        backgroundColor: colors.dangerLight,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.danger,
      }}
    >
      <Text style={{ ...typography.lg, fontWeight: '700', color: colors.danger }}>
        ⚠️ {strings.urgency.title}
      </Text>
      <Text style={{ ...typography.base, color: colors.text.primary }}>
        {strings.urgency.message}
      </Text>
      <View
        style={{
          backgroundColor: colors.background.primary,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.xs,
        }}
      >
        <Text style={{ ...typography.sm, fontWeight: '600', color: colors.text.primary }}>
          Contactos de emergência:
        </Text>
        <Text style={{ ...typography.base, color: colors.primary, fontWeight: '600' }} selectable>
          SNS 24: 808 24 24 24
        </Text>
        <Text style={{ ...typography.base, color: colors.danger, fontWeight: '600' }} selectable>
          Emergência: 112
        </Text>
      </View>
      <Pressable testID="urgency-dismiss" onPress={onDismiss}>
        <Text
          style={{
            ...typography.sm,
            color: colors.text.secondary,
            textAlign: 'center',
            textDecorationLine: 'underline',
          }}
        >
          {strings.urgency.dismiss}
        </Text>
      </Pressable>
    </View>
  );
}
