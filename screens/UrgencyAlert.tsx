import { View, Text, Pressable, Linking } from 'react-native';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { strings } from '@/constants/strings';

type Props = {
  onDismiss: () => void;
};

export function UrgencyAlert({ onDismiss }: Props) {
  return (
    <View
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
      <Pressable
        onPress={() => Linking.openURL('tel:808242424')}
        style={{
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          padding: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ ...typography.base, fontWeight: '600', color: '#fff' }}>
          {strings.urgency.snsCta}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => Linking.openURL('tel:112')}
        style={{
          backgroundColor: colors.danger,
          borderRadius: radius.md,
          padding: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ ...typography.base, fontWeight: '600', color: '#fff' }}>
          {strings.urgency.emergencyCta}
        </Text>
      </Pressable>
      <Pressable onPress={onDismiss}>
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
