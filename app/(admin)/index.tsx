import { FlatList, View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { colors, spacing, typography, radius } from '@/constants/theme';

const ROLE_LABELS: Record<string, string> = {
  patient: 'Utente',
  professional: 'Profissional',
  admin: 'Admin',
};

export default function AdminPanel() {
  const users = useQuery(api.users.listUsers);
  const setRole = useMutation(api.users.setRole);

  if (users === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  function handleRoleChange(userId: string, currentRole: string, newRole: 'patient' | 'professional' | 'admin') {
    Alert.alert(
      'Alterar role',
      `Mudar de ${ROLE_LABELS[currentRole] ?? currentRole} para ${ROLE_LABELS[newRole]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => setRole({ targetUserId: userId as any, role: newRole }) },
      ]
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      contentInsetAdjustmentBehavior="automatic"
      ListEmptyComponent={
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Text style={{ ...typography.base, color: colors.text.secondary }}>
            Nenhum utilizador encontrado.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ backgroundColor: colors.background.primary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }}>
          <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }} selectable>
            {item.user?.email ?? item.userId}
          </Text>
          <Text style={{ ...typography.sm, color: colors.text.secondary }}>
            Role atual: {ROLE_LABELS[item.role] ?? item.role}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {(['patient', 'professional', 'admin'] as const)
              .filter((r) => r !== item.role)
              .map((r) => (
                <Pressable
                  key={r}
                  onPress={() => handleRoleChange(item.userId, item.role, r)}
                  style={{ backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}
                >
                  <Text style={{ ...typography.xs, fontWeight: '600', color: colors.primary }}>
                    Tornar {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
      )}
    />
  );
}
