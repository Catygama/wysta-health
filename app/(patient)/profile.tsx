import { View, Text, ScrollView } from 'react-native';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radius } from '@/constants/theme';

export default function Profile() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={{ ...typography['2xl'], fontWeight: '700', color: colors.text.primary }}>
        O meu perfil
      </Text>

      <View style={{ backgroundColor: colors.background.secondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ ...typography.sm, color: colors.text.secondary }}>Email</Text>
        <Text style={{ ...typography.base, color: colors.text.primary }} selectable>
          {user?.email ?? '—'}
        </Text>
      </View>

      {user?.profile && (
        <View style={{ backgroundColor: colors.background.secondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }}>
            Dados de saúde
          </Text>
          {user.profile.ageRange ? (
            <Text style={{ ...typography.sm, color: colors.text.secondary }}>
              Faixa etária: {user.profile.ageRange}
            </Text>
          ) : null}
          {user.profile.pregnancyStatus ? (
            <Text style={{ ...typography.sm, color: colors.text.secondary }}>
              Estado de gravidez: {user.profile.pregnancyStatus}
            </Text>
          ) : null}
        </View>
      )}

      <Button label="Sair" onPress={() => signOut()} variant="secondary" />
    </ScrollView>
  );
}
