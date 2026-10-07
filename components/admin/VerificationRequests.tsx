import { useState } from 'react';
import { View, Text, Pressable, TextInput, Linking } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

type Request = NonNullable<ReturnType<typeof useQuery<typeof api.users.listPendingVerifications>>>[number];
type Pending = { kind: 'approve' | 'reject'; request: Request; reason?: string };

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Admin review of professional sign-ups: the admin checks the licence with the
// Ordem dos Enfermeiros, then approves or rejects (with an optional reason).
export function VerificationRequests() {
  const requests = useQuery(api.users.listPendingVerifications);
  const approve = useMutation(api.users.approveProfessional);
  const reject = useMutation(api.users.rejectProfessional);
  const [rejecting, setRejecting] = useState<Id<'users'> | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests === undefined) return null;

  const name = (r: Request) => r.displayName ?? r.email ?? 'Profissional';

  async function confirm() {
    if (!pending) return;
    setError(null);
    try {
      if (pending.kind === 'approve') await approve({ userId: pending.request.userId });
      else await reject({ userId: pending.request.userId, reason: pending.reason || undefined });
      setRejecting(null);
      setReason('');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível concluir a ação.');
    } finally {
      setPending(null);
    }
  }

  return (
    <View testID="verification-requests" style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        Pedidos de verificação {requests.length > 0 ? `(${requests.length})` : ''}
      </Text>
      {requests.length === 0 ? (
        <Text style={styles.empty}>Sem pedidos pendentes.</Text>
      ) : (
        requests.map((r) => (
          <View key={r.userId} testID={`verification-request-${r.email}`} style={styles.card}>
            <Text style={styles.name}>{name(r)}</Text>
            <Field label="Email" value={r.email ?? '—'} />
            <Field label="Cédula profissional" value={r.licenseNumber ?? '—'} />
            <Field label="Especialidade" value={r.specialty ?? '—'} />
            <Field label="Data do pedido" value={formatDate(r.requestedAt)} />
            {r.notes ? <Field label="Notas" value={r.notes} /> : null}
            <View style={styles.docs}>
              <Text style={styles.label}>Documentos</Text>
              {r.documents.length === 0 ? (
                <Text style={styles.value}>Nenhum documento enviado.</Text>
              ) : (
                r.documents.map((d, i) =>
                  d.url ? (
                    <DocLink key={d.id} index={i + 1} url={d.url} />
                  ) : (
                    <Text key={d.id} style={styles.value}>Documento {i + 1} (indisponível)</Text>
                  )
                )
              )}
            </View>

            {rejecting === r.userId ? (
              <View style={styles.rejectBox}>
                <Text style={styles.label}>Motivo da recusa (opcional)</Text>
                <TextInput
                  testID="verification-reject-reason"
                  accessibilityLabel="Motivo da recusa (opcional)"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Ex.: cédula não encontrada na Ordem dos Enfermeiros"
                  multiline
                  style={styles.input}
                />
                <View style={styles.actions}>
                  <Button
                    kind="ghost"
                    size="sm"
                    label="Cancelar"
                    onPress={() => {
                      setRejecting(null);
                      setReason('');
                    }}
                  />
                  <Button
                    testID="verification-reject-confirm"
                    kind="danger"
                    size="sm"
                    label="Recusar pedido"
                    onPress={() => setPending({ kind: 'reject', request: r, reason: reason.trim() })}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Button
                  testID="verification-approve"
                  size="sm"
                  label="Aprovar"
                  onPress={() => setPending({ kind: 'approve', request: r })}
                />
                <Button
                  testID="verification-reject"
                  kind="ghost"
                  size="sm"
                  label="Recusar"
                  onPress={() => {
                    setRejecting(r.userId);
                    setReason('');
                  }}
                />
              </View>
            )}
          </View>
        ))
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <ConfirmDialog
        testID="verification-dialog"
        visible={pending !== null}
        title={pending?.kind === 'approve' ? 'Aprovar pedido?' : 'Recusar pedido?'}
        message={
          pending
            ? pending.kind === 'approve'
              ? `Confirmas que verificaste a cédula ${pending.request.licenseNumber ?? ''} de ${name(pending.request)} junto da Ordem dos Enfermeiros? A conta fica com acesso de profissional.`
              : `${name(pending.request)} não terá acesso de profissional.${pending.reason ? ` Motivo: ${pending.reason}` : ''}`
            : undefined
        }
        confirmLabel={pending?.kind === 'approve' ? 'Aprovar' : 'Recusar'}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function DocLink({ index, url }: { index: number; url: string }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir documento ${index}`}
      onPress={() => Linking.openURL(url)}
      hitSlop={6}
      style={styles.docLink}
    >
      <Icon name={{ sf: 'doc.text', ion: 'document-text-outline' }} size={16} color={theme.colors.inkText} />
      <Text style={styles.docText}>Documento {index}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.spacing.sm },
  heading: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  empty: { fontSize: 14, color: theme.colors.textSecondary },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  name: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  field: { gap: 2 },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  value: { fontSize: 14, color: theme.colors.textPrimary },
  docs: { gap: 4 },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  docText: { fontSize: 14, color: theme.colors.inkText, textDecorationLine: 'underline' },
  rejectBox: { gap: theme.spacing.sm },
  input: {
    minHeight: 72,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
    padding: theme.spacing.sm,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  error: { fontSize: 13, color: theme.colors.danger },
}));
