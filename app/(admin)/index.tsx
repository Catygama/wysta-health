import { useState } from 'react';
import { FlatList, View, Text, Pressable, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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

// Same hues, lightened so they stay readable on the dark theme.
const ROLE_COLORS_DARK: Record<string, string> = {
  patient: '#F2A0AC',
  professional: '#6FD3B0',
  admin: '#F0B45E',
};

type Role = 'patient' | 'professional' | 'admin';

const GUEST_LABELS: Record<string, string> = {
  patient: 'Utente convidada',
  professional: 'Profissional convidado',
  admin: 'Convidado',
};

// What the admin sees as the user's name: the name they gave, else the email,
// else a guest label (anonymous accounts have neither).
function nameOf(u: { displayName?: string; role: string; user?: { email?: string; name?: string } | null }) {
  return u.displayName?.trim() || u.user?.name?.trim() || u.user?.email || GUEST_LABELS[u.role] || 'Sem nome';
}

export default function AdminPanel() {
  const users = useQuery(api.users.listUsers);
  const me = useQuery(api.users.currentUser);
  const setRole = useMutation(api.users.setRole);
  const blockUser = useMutation(api.users.blockUser);
  const unblockUser = useMutation(api.users.unblockUser);
  const deleteUser = useMutation(api.users.deleteUser);
  const [search, setSearch] = useState('');
  // The user whose card was tapped: the dialog to change their role.
  const [editing, setEditing] = useState<{
    userId: string;
    name: string;
    email?: string;
    role: string;
    newRole: string;
    blocked: boolean;
  } | null>(null);
  // Block / unblock / delete, confirmed in its own dialog.
  const [action, setAction] = useState<{
    kind: 'block' | 'unblock' | 'delete';
    userId: string;
    name: string;
    role: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');

  function startAction(kind: 'block' | 'unblock' | 'delete') {
    if (!editing) return;
    const next = { kind, userId: editing.userId, name: editing.name, role: editing.role };
    setEditing(null);
    // Opened once the role dialog has faded out, so the two don't overlap.
    setTimeout(() => setAction(next), 250);
    setReason('');
    setTyped('');
  }
  const { theme } = useUnistyles();

  if (users === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }


  const filtered = users
    .slice()
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    .filter((u) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        nameOf(u).toLowerCase().includes(q) ||
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
    <>
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

          {/* On web these live in the side bar; the phone has no bar for admin. */}
          {Platform.OS !== 'web' && (
            <>
              <Link href="/(admin)/verifications" asChild>
                <Pressable testID="admin-verifications-link" style={styles.linkCard}>
                  <View style={styles.linkBody}>
                    <Text style={styles.cardTitle}>Verificações</Text>
                    <Text style={styles.cardSub}>Aprovar ou recusar pedidos de profissionais.</Text>
                  </View>
                  <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={16} color={theme.colors.textTertiary} />
                </Pressable>
              </Link>
              <Link href="/(admin)/content" asChild>
                <Pressable testID="admin-content-link" style={styles.linkCard}>
                  <View style={styles.linkBody}>
                    <Text style={styles.cardTitle}>Conteúdos</Text>
                    <Text style={styles.cardSub}>Escrever, editar e publicar os artigos do Explorar.</Text>
                  </View>
                  <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={16} color={theme.colors.textTertiary} />
                </Pressable>
              </Link>
              <Link href="/(admin)/my-account" asChild>
                <Pressable testID="admin-profile-link" style={styles.linkCard}>
                  <View style={styles.linkBody}>
                    <Text style={styles.cardTitle}>Perfil</Text>
                    <Text style={styles.cardSub}>Tema e terminar sessão.</Text>
                  </View>
                  <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={16} color={theme.colors.textTertiary} />
                </Pressable>
              </Link>
              <Link href="/(admin)/ai" asChild>
                <Pressable testID="admin-ai-link" style={styles.linkCard}>
                  <View style={styles.linkBody}>
                    <Text style={styles.cardTitle}>Gestão da IA</Text>
                    <Text style={styles.cardSub}>Configs, prompts, audit das invocações + teste rápido.</Text>
                  </View>
                  <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={16} color={theme.colors.textTertiary} />
                </Pressable>
              </Link>
            </>
          )}

          <Text style={styles.usersHeading}>Utilizadores</Text>

          <View style={styles.searchBar}>
            <Icon name={{ sf: 'magnifyingglass', ion: 'search' }} size={16} color={theme.colors.textTertiary} />
            <TextInput
              testID="admin-search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar por nome, email ou role..."
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
      renderItem={({ item }) => {
        const dark = theme.name === 'dark';
        const roleColor = (dark ? ROLE_COLORS_DARK : ROLE_COLORS)[item.role] ?? theme.colors.textSecondary;
        const name = nameOf(item);
        // Your own role is changed by another admin, not here.
        const isMe = item.userId === me?._id;
        const meta = [name !== item.user?.email ? item.user?.email : null, item.ageRange, item.location]
          .filter(Boolean)
          .join(' • ');
        return (
          <Pressable
            testID={`admin-user-row-${item.user?.email ?? item.userId}`}
            accessibilityRole="button"
            accessibilityLabel={
              isMe
                ? `${name} (tu), ${ROLE_LABELS[item.role] ?? item.role}`
                : `${name}, ${ROLE_LABELS[item.role] ?? item.role}. Alterar role`
            }
            disabled={isMe}
            onPress={() =>
              setEditing({
                userId: item.userId,
                name,
                email: item.user?.email,
                role: item.role,
                newRole: item.role,
                blocked: !!item.blockedAt,
              })
            }
            style={({ pressed }) => [styles.userRow, pressed && styles.userRowPressed]}
          >
            <View style={styles.userTop}>
              <Text style={styles.userEmail} numberOfLines={1}>
                {name}
                {isMe ? <Text style={styles.userMe}> (tu)</Text> : null}
              </Text>
              <View style={styles.badges}>
                {item.blockedAt ? (
                  <View testID="admin-user-blocked" style={styles.blockedBadge}>
                    <Text style={styles.blockedBadgeText}>Bloqueada</Text>
                  </View>
                ) : null}
                <View style={[styles.roleBadge, { backgroundColor: roleColor + (dark ? '29' : '20') }]}>
                  <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                    {ROLE_LABELS[item.role] ?? item.role}
                  </Text>
                </View>
              </View>
            </View>

            {meta ? <Text style={styles.userMeta}>{meta}</Text> : null}
          </Pressable>
        );
      }}
    />
    <ConfirmDialog
      testID="role-change-dialog"
      visible={editing !== null}
      title={editing?.name ?? ''}
      message={editing ? (editing.email ?? 'Conta de convidado, sem email.') : undefined}
      confirmLabel="Guardar"
      confirmDisabled={!editing || editing.newRole === editing.role}
      onCancel={() => setEditing(null)}
      onConfirm={async () => {
        if (!editing) return;
        await setRole({ targetUserId: editing.userId as any, role: editing.newRole as Role });
        setEditing(null);
      }}
    >
      <View style={styles.roleOptions} accessibilityRole="radiogroup">
        <Text style={styles.roleOptionsLabel}>Role</Text>
        {(['patient', 'professional', 'admin'] as const).map((r) => {
          const selected = editing?.newRole === r;
          return (
            <Pressable
              key={r}
              testID={`admin-role-option-${r}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => editing && setEditing({ ...editing, newRole: r })}
              style={[styles.roleOption, selected && styles.roleOptionOn]}
            >
              <Icon
                name={
                  selected
                    ? { sf: 'largecircle.fill.circle', ion: 'radio-button-on' }
                    : { sf: 'circle', ion: 'radio-button-off' }
                }
                size={18}
                color={selected ? theme.colors.inkText : theme.colors.textTertiary}
              />
              <Text style={[styles.roleOptionText, selected && styles.roleOptionTextOn]}>
                {ROLE_LABELS[r]}
                {editing?.role === r ? ' (atual)' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.accountActions}>
        <Text style={styles.roleOptionsLabel}>Conta</Text>
        <View style={styles.accountButtons}>
          <Button
            testID={editing?.blocked ? 'admin-unblock' : 'admin-block'}
            kind="secondary"
            size="sm"
            label={editing?.blocked ? 'Desbloquear acesso' : 'Bloquear acesso'}
            onPress={() => startAction(editing?.blocked ? 'unblock' : 'block')}
          />
          <Button testID="admin-delete" kind="ghost" size="sm" label="Apagar conta" onPress={() => startAction('delete')} />
        </View>
      </View>
    </ConfirmDialog>

    <ConfirmDialog
      testID="account-action-dialog"
      visible={action !== null}
      title={
        action?.kind === 'block'
          ? 'Bloquear acesso?'
          : action?.kind === 'unblock'
            ? 'Desbloquear acesso?'
            : 'Apagar conta?'
      }
      message={action ? actionMessage(action) : undefined}
      confirmLabel={action?.kind === 'block' ? 'Bloquear' : action?.kind === 'unblock' ? 'Desbloquear' : 'Apagar'}
      confirmDisabled={action?.kind === 'delete' && typed.trim().toUpperCase() !== 'APAGAR'}
      onCancel={() => setAction(null)}
      onConfirm={async () => {
        if (!action) return;
        const userId = action.userId as any;
        if (action.kind === 'block') await blockUser({ userId, reason: reason.trim() || undefined });
        else if (action.kind === 'unblock') await unblockUser({ userId });
        else await deleteUser({ userId, confirmation: 'APAGAR' });
        setAction(null);
      }}
    >
      {action?.kind === 'block' && (
        <TextInput
          testID="admin-block-reason"
          accessibilityLabel="Motivo (opcional)"
          value={reason}
          onChangeText={setReason}
          placeholder="Motivo (opcional, fica no registo)"
          placeholderTextColor={theme.colors.textTertiary as any}
          style={styles.dialogInput}
        />
      )}
      {action?.kind === 'delete' && (
        <TextInput
          testID="admin-delete-confirm-text"
          accessibilityLabel="Escreve APAGAR para confirmar"
          value={typed}
          onChangeText={setTyped}
          placeholder="Escreve APAGAR para confirmar"
          placeholderTextColor={theme.colors.textTertiary as any}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.dialogInput}
        />
      )}
    </ConfirmDialog>
    </>
  );
}

// What each account action does, in the confirmation dialog.
function actionMessage(a: { kind: 'block' | 'unblock' | 'delete'; name: string; role: string }): string {
  if (a.kind === 'block') {
    return `${a.name} deixa de conseguir usar a Wysta e a sessão termina em todos os dispositivos. Nada é apagado: podes desbloquear depois.`;
  }
  if (a.kind === 'unblock') return `${a.name} volta a poder entrar na Wysta.`;
  if (a.role === 'professional') {
    return `Apaga para sempre a conta de ${a.name}. As conversas em curso voltam aos Pedidos; o que escreveu fica nas conversas das utentes. Não é possível desfazer.`;
  }
  if (a.role === 'admin') return `Apaga para sempre a conta de administração de ${a.name}. Não é possível desfazer.`;
  return `Apaga para sempre a conta de ${a.name}, com as conversas, mensagens e ficheiros. Não é possível desfazer.`;
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
  userRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  userTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  userEmail: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary, flex: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  blockedBadge: {
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
  },
  blockedBadgeText: { fontSize: 12, fontWeight: '600', color: theme.colors.danger },
  accountActions: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  accountButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  dialogInput: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
    paddingHorizontal: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  roleBadge: { paddingVertical: 2, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.pill },
  roleBadgeText: { fontSize: 12, fontWeight: '500' },
  userMeta: { fontSize: 12, color: theme.colors.textSecondary },
  userRowPressed: { opacity: 0.7 },
  userMe: { fontWeight: '400', color: theme.colors.textSecondary },
  roleOptions: { gap: theme.spacing.xs },
  roleOptionsLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  roleOptionOn: { borderColor: theme.colors.inkText, backgroundColor: theme.colors.surfaceSunken },
  roleOptionText: { fontSize: 15, color: theme.colors.textPrimary },
  roleOptionTextOn: { fontWeight: '600', color: theme.colors.inkText },
}));
