import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ThemeCard } from '@/components/ThemeCard';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fonts } from '@/lib/fonts';

// Admin "Perfil": the account email, the theme and sign out. Same look as the
// patient and professional profiles, without personal or clinical data.
export default function AdminProfile() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const { theme } = useUnistyles();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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

      <View style={styles.card}>
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue} selectable>
            {user?.email ?? '—'}
          </Text>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Papel</Text>
          <Text style={styles.rowValue}>Administrador</Text>
        </View>
      </View>

      <ThemeCard />

      <Button
        testID="admin-signout"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg, width: '100%', maxWidth: 720, alignSelf: 'flex-start' },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  rowItem: { gap: 2 },
  rowLabel: { fontSize: 12, color: theme.colors.textSecondary },
  rowValue: { fontSize: 16, color: theme.colors.textPrimary },
}));
