import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { HistoryLink } from '@/components/HistoryLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';

export default function ProfessionalProfile() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const { theme } = useUnistyles();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const profile = user?.profile;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.card}>
        <Text style={styles.name}>{profile?.displayName ?? 'Profissional'}</Text>
        {profile?.professionalSpecialty && (
          <Text style={styles.meta}>{profile.professionalSpecialty}</Text>
        )}
        {profile?.professionalLicenseNumber && (
          <Text style={styles.meta}>Cédula {profile.professionalLicenseNumber}</Text>
        )}
        <Text style={styles.meta} selectable>
          {user?.email ?? '—'}
        </Text>
      </View>

      <HistoryLink onPress={() => router.push('/(professional)/profile/history')} />

      <Pressable
        testID="professional-signout"
        onPress={() => setConfirmSignOut(true)}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Icon
          name={{ sf: 'rectangle.portrait.and.arrow.right', ion: 'log-out-outline' }}
          size={18}
          color={theme.colors.danger}
        />
        <Text style={styles.signOutText}>Terminar sessão</Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Terminar sessão?"
        confirmLabel="Sair"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => signOut()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    gap: 2,
  },
  name: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  meta: { fontSize: 14, color: theme.colors.textSecondary },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  pressed: { opacity: 0.7 },
  signOutText: { fontSize: 15, fontWeight: '500', color: theme.colors.danger },
}));
