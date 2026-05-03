import { useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, typography, radius } from '@/constants/theme';

const ROLE_LABELS: Record<string, string> = {
  patient: 'Utente',
  professional: 'Profissional',
  admin: 'Admin',
};

const ROLE_COLORS: Record<string, string> = {
  patient: '#7C3AED',
  professional: '#0891B2',
  admin: '#D97706',
};

export default function AdminPanel() {
  const { signOut } = useAuthActions();
  const users = useQuery(api.users.listUsers);
  const setRole = useMutation(api.users.setRole);
  const seedAll = useMutation(api.seed.seedAll);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');

  if (users === undefined) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  function confirmRoleChange(
    userId: string,
    currentRole: string,
    newRole: 'patient' | 'professional' | 'admin'
  ) {
    Alert.alert(
      'Alterar role',
      `Mudar de ${ROLE_LABELS[currentRole] ?? currentRole} para ${ROLE_LABELS[newRole]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () =>
            setRole({ targetUserId: userId as any, role: newRole }),
        },
      ]
    );
  }

  async function runSeed() {
    setSeeding(true);
    setSeedResult(null);
    try {
      const r = await seedAll();
      setSeedResult(
        `Triagem: ${r.triage.inserted} inseridas, ${r.triage.updated} atualizadas. Artigos: ${r.articles.inserted} inseridos, ${r.articles.updated} atualizados.`
      );
    } catch (e: any) {
      setSeedResult(e?.message ?? 'Erro ao executar seed.');
    } finally {
      setSeeding(false);
    }
  }

  const filtered = users
    .slice()
    .sort((a, b) => (a.user?.email ?? '').localeCompare(b.user?.email ?? ''))
    .filter((u) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.user?.email ?? '').toLowerCase().includes(q) ||
        (u.role ?? '').toLowerCase().includes(q)
      );
    });

  const counts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
          <Text
            style={{
              ...typography['2xl'],
              fontWeight: '700',
              color: colors.text.primary,
            }}
          >
            Administração
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <CountCard label="Utentes" value={counts.patient ?? 0} />
            <CountCard
              label="Profissionais"
              value={counts.professional ?? 0}
            />
            <CountCard label="Admins" value={counts.admin ?? 0} />
          </View>

          <View
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text
              style={{
                ...typography.sm,
                fontWeight: '600',
                color: colors.text.primary,
              }}
            >
              Conteúdo da plataforma
            </Text>
            <Text
              style={{ ...typography.xs, color: colors.text.secondary }}
            >
              Insere ou atualiza triagens e artigos educativos pré-definidos. Pode ser executado várias vezes sem duplicar registos.
            </Text>
            <Button
              label="Atualizar triagens e artigos"
              variant="secondary"
              onPress={runSeed}
              loading={seeding}
            />
            {seedResult && (
              <Text
                style={{
                  ...typography.xs,
                  color: colors.text.secondary,
                }}
              >
                {seedResult}
              </Text>
            )}
          </View>

          <Text
            style={{
              ...typography.lg,
              fontWeight: '600',
              color: colors.text.primary,
              marginTop: spacing.sm,
            }}
          >
            Utilizadores
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Text style={{ ...typography.base, color: colors.text.secondary }}>
            Nenhum utilizador encontrado.
          </Text>
        </View>
      }
      ListFooterComponent={
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Terminar sessão"
            variant="secondary"
            onPress={() => signOut()}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: colors.background.primary,
            borderRadius: radius.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Text
              style={{
                ...typography.base,
                fontWeight: '600',
                color: colors.text.primary,
                flex: 1,
              }}
              selectable
              numberOfLines={1}
            >
              {item.user?.email ?? item.userId}
            </Text>
            <View
              style={{
                backgroundColor: (ROLE_COLORS[item.role] ?? '#6B7280') + '20',
                paddingVertical: 2,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.full,
              }}
            >
              <Text
                style={{
                  ...typography.xs,
                  fontWeight: '700',
                  color: ROLE_COLORS[item.role] ?? '#6B7280',
                }}
              >
                {ROLE_LABELS[item.role] ?? item.role}
              </Text>
            </View>
          </View>

          {(item.displayName || item.location || item.ageRange) && (
            <Text style={{ ...typography.xs, color: colors.text.secondary }}>
              {[item.displayName, item.ageRange, item.location]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.xs,
              flexWrap: 'wrap',
            }}
          >
            {(['patient', 'professional', 'admin'] as const)
              .filter((r) => r !== item.role)
              .map((r) => (
                <Pressable
                  key={r}
                  onPress={() =>
                    confirmRoleChange(item.userId, item.role, r)
                  }
                  style={({ pressed }) => ({
                    backgroundColor: pressed
                      ? colors.background.tertiary
                      : colors.primaryLight,
                    borderRadius: radius.full,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  })}
                >
                  <Icon
                    name={{
                      sf: 'arrow.right.circle.fill',
                      ion: 'arrow-forward-circle',
                    }}
                    size={12}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      ...typography.xs,
                      fontWeight: '600',
                      color: colors.primary,
                    }}
                  >
                    {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
      )}
    />
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <Text style={{ ...typography.xs, color: colors.text.secondary }}>
        {label}
      </Text>
      <Text
        style={{
          ...typography['2xl'],
          fontWeight: '700',
          color: colors.text.primary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
