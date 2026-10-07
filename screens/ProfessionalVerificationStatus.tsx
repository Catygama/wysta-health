import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

type Props = {
  status: 'pending' | 'rejected';
  rejectionReason?: string;
};

// Shown instead of the professional area while an admin reviews the sign-up,
// or after it was rejected. The profile query is reactive, so an approval
// replaces this screen with the queue without signing in again.
export function ProfessionalVerificationStatus({ status, rejectionReason }: Props) {
  const { theme } = useUnistyles();
  const { signOut } = useAuthActions();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const pending = status === 'pending';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View testID={`verification-${status}`} style={styles.card} accessibilityRole="summary">
        <View style={styles.icon}>
          <Icon
            name={pending ? { sf: 'clock.fill', ion: 'time' } : { sf: 'xmark.circle.fill', ion: 'close-circle' }}
            size={28}
            color={theme.colors.inkText}
          />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {pending ? 'O teu pedido está em verificação' : 'O teu pedido não foi aprovado'}
        </Text>
        {pending ? (
          <>
            <Text style={styles.body}>
              Estamos a confirmar a tua cédula profissional junto da Ordem dos Enfermeiros antes de
              ativar a tua conta.
            </Text>
            <Text style={styles.body}>
              Quando o pedido for aprovado, passas a ter acesso à fila e às conversas. Este ecrã
              atualiza-se sozinho.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Não conseguimos confirmar os dados do teu registo como profissional de saúde.
            </Text>
            {rejectionReason ? (
              <View style={styles.reason}>
                <Text style={styles.reasonLabel}>Motivo</Text>
                <Text testID="verification-rejection-reason" style={styles.body}>
                  {rejectionReason}
                </Text>
              </View>
            ) : null}
            <Text style={styles.body}>Se achas que se trata de um engano, contacta a equipa da Wysta.</Text>
          </>
        )}
      </View>

      <Button
        testID="verification-signout"
        label="Terminar sessão"
        kind="secondary"
        onPress={() => setConfirmSignOut(true)}
      />
      <ConfirmDialog
        visible={confirmSignOut}
        title="Terminar sessão?"
        message="Tens a certeza que queres terminar a sessão?"
        confirmLabel="Sair"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          await signOut();
          setConfirmSignOut(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingTop: theme.spacing.xxl },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.displayBold, fontSize: 22, color: theme.colors.textPrimary },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.textSecondary },
  reason: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  reasonLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
}));
