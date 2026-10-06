import { useState } from 'react';
import { FlatList, View, Text, Pressable, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Link } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

const ROLE_LABELS: Record<string, string> = {
  patient: 'Utente',
  professional: 'Profissional',
  admin: 'Admin',
};

const ROLE_COLORS: Record<string, string> = {
  patient: '#50000D',
  professional: '#0F6E56',
  admin: '#C77B16',
};

export default function AdminPanel() {
  const { signOut } = useAuthActions();
  const users = useQuery(api.users.listUsers);
  const setRole = useMutation(api.users.setRole);
  const seedAll = useMutation(api.seed.seedAll);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const { theme } = useUnistyles();

  if (users === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.inkText} />
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
        { text: 'Confirmar', onPress: () => setRole({ targetUserId: userId as any, role: newRole }) },
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
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Administração</Text>

          <View style={styles.countRow}>
            <CountCard testID="admin-count-patient" label="Utentes" value={counts.patient ?? 0} />
            <CountCard testID="admin-count-professional" label="Profissionais" value={counts.professional ?? 0} />
            <CountCard testID="admin-count-admin" label="Admins" value={counts.admin ?? 0} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conteúdo da plataforma</Text>
            <Text style={styles.cardSub}>
              Insere ou atualiza triagens e artigos educativos pré-definidos. Pode ser
              executado várias vezes sem duplicar registos.
            </Text>
            <Button
              testID="admin-seed-button"
              label="Atualizar triagens e artigos"
              variant="secondary"
              onPress={runSeed}
              loading={seeding}
            />
            {seedResult && (
              <Text testID="admin-seed-result" style={styles.cardSub}>{seedResult}</Text>
            )}
          </View>

          <Link href="/(admin)/ai" asChild>
            <Pressable testID="admin-ai-link" style={styles.linkCard}>
              <View style={styles.linkBody}>
                <Text style={styles.cardTitle}>AI Infra</Text>
                <Text style={styles.cardSub}>Configs, prompts, audit das invocações + teste rápido.</Text>
              </View>
              <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={16} color={theme.colors.textTertiary} />
            </Pressable>
          </Link>

          <Text style={styles.usersHeading}>Utilizadores</Text>

          <View style={styles.searchBar}>
            <Icon name={{ sf: 'magnifyingglass', ion: 'search' }} size={16} color={theme.colors.textTertiary} />
            <TextInput
              testID="admin-search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar por email ou role..."
              placeholderTextColor={theme.colors.textTertiary as any}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={styles.searchInput}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhum utilizador encontrado.</Text>
        </View>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          <Button label="Terminar sessão" variant="secondary" onPress={() => signOut()} />
        </View>
      }
      renderItem={({ item }) => {
        const roleColor = ROLE_COLORS[item.role] ?? theme.colors.textSecondary;
        return (
          <View testID={`admin-user-row-${item.user?.email ?? item.userId}`} style={styles.userRow}>
            <View style={styles.userTop}>
              <Text style={styles.userEmail} selectable numberOfLines={1}>
                {item.user?.email ?? item.userId}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                  {ROLE_LABELS[item.role] ?? item.role}
                </Text>
              </View>
            </View>

            {(item.displayName || item.location || item.ageRange) && (
              <Text style={styles.userMeta}>
                {[item.displayName, item.ageRange, item.location].filter(Boolean).join(' • ')}
              </Text>
            )}

            <View style={styles.roleActions}>
              {(['patient', 'professional', 'admin'] as const)
                .filter((r) => r !== item.role)
                .map((r) => (
                  <Pressable
                    key={r}
                    testID={`admin-role-${item.user?.email ?? item.userId}-${r}`}
                    onPress={() => confirmRoleChange(item.userId, item.role, r)}
                    style={styles.rolePill}
                  >
                    <Icon name={{ sf: 'arrow.right.circle.fill', ion: 'arrow-forward-circle' }} size={12} color={theme.colors.inkText} />
                    <Text style={styles.rolePillText}>{ROLE_LABELS[r]}</Text>
                  </Pressable>
                ))}
            </View>
          </View>
        );
      }}
    />
  );
}

function CountCard({ label, value, testID }: { label: string; value: number; testID?: string }) {
  return (
    <View testID={testID} style={styles.countCard}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={styles.countValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.sm },
  header: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
  countRow: { flexDirection: 'row', gap: theme.spacing.sm },
  countCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  countLabel: { fontSize: 12, color: theme.colors.textSecondary },
  countValue: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: theme.colors.textPrimary },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary },
  linkCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkBody: { flex: 1, gap: 2 },
  usersHeading: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary, marginTop: theme.spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSunken,
  },
  searchInput: { flex: 1, paddingVertical: theme.spacing.sm, fontSize: 16, color: theme.colors.textPrimary },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 16, color: theme.colors.textSecondary },
  footer: { marginTop: theme.spacing.lg },
  userRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  userTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  userEmail: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary, flex: 1 },
  roleBadge: { paddingVertical: 2, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.pill },
  roleBadgeText: { fontSize: 12, fontWeight: '500' },
  userMeta: { fontSize: 12, color: theme.colors.textSecondary },
  roleActions: { flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' },
  rolePill: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rolePillText: { fontSize: 12, fontWeight: '500', color: theme.colors.inkText },
}));
