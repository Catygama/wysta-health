import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { HistoryLink } from '@/components/HistoryLink';
import { ThemeCard } from '@/components/ThemeCard';
import { AcademicNotice } from '@/components/AcademicNotice';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

const VERIFICATION_LABELS: Record<string, string> = {
  pending: 'Em análise',
  verified: 'Verificado',
  rejected: 'Não aprovado',
};

// Same structure and look as the patient profile, with professional data in
// place of health data.
export default function ProfessionalProfile() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const { theme } = useUnistyles();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const profile = user?.profile;

  if (user === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title}>O meu perfil</Text>

      <Card>
        <Row label="Email" value={user?.email ?? '—'} selectable />
      </Card>

      <HistoryLink onPress={() => router.push('/(professional)/account/history')} />

      <Card title="Dados profissionais">
        <Row label="Nome" value={profile?.displayName ?? '—'} />
        <Row label="Especialidade" value={profile?.professionalSpecialty ?? '—'} />
        <Row label="Cédula profissional" value={profile?.professionalLicenseNumber ?? '—'} />
        <Row
          label="Verificação"
          value={VERIFICATION_LABELS[profile?.professionalVerificationStatus ?? ''] ?? '—'}
        />
      </Card>

      <ThemeCard />

      <View style={styles.privacy}>
        <Icon name={{ sf: 'lock.shield.fill', ion: 'lock-closed' }} size={20} color={theme.colors.inkText} />
        <View style={styles.privacyBody}>
          <Text style={styles.privacyTitle}>Confidencialidade</Text>
          <Text style={styles.privacyText}>
            Os dados das utentes são confidenciais. As notas internas só são visíveis a
            enfermeiros.
          </Text>
        </View>
      </View>

      <Button
        testID="professional-signout"
        label="Terminar sessão"
        variant="primary"
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

      <AcademicNotice />
    </ScrollView>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function Row({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.rowItem}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable={selectable}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  rowItem: { gap: 2 },
  rowLabel: { fontSize: 12, color: theme.colors.textSecondary },
  rowValue: { fontSize: 16, color: theme.colors.textPrimary },
  privacy: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  privacyBody: { flex: 1, gap: 2 },
  privacyTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.inkText },
  privacyText: { fontSize: 12, color: theme.colors.textSecondary },
}));
