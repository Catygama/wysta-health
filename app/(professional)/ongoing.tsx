import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Button } from '@/components/ui/Button';
import { fonts } from '@/lib/fonts';
import { HeaderBack } from '@/components/ui/HeaderBack';

// "Conversas": the professional's open conversations with patients (assigned
// to them). Closed conversations live in Perfil → Histórico.
export default function Ongoing() {
  const router = useRouter();
  const stats = useQuery(api.conversations.queueStats);
  const conversations = useQuery(api.conversations.listForProfessional, { scope: 'mine' });

  const unassigned = stats?.unassigned ?? 0;

  return (
    <View style={styles.root}>
      {/* Same header as the patient's Conversas screen; the arrow goes to the
          Fila, the professional's main screen. */}
      <View style={styles.titleRow}>
        <HeaderBack home="/(professional)/queue" />
        <Text style={styles.title} accessibilityRole="header">
          Conversas
        </Text>
      </View>
      <ConversationList
        conversations={(conversations ?? []) as any}
        basePath="/(professional)/cases"
        showPriority
        emptyComponent={
          conversations === undefined ? null : (
            <View testID="ongoing-empty" style={styles.empty}>
              <Text style={styles.emptyText}>Não tens conversas em curso.</Text>
              {unassigned > 0 && (
                <Button
                  testID="ongoing-empty-show-requests"
                  kind="secondary"
                  size="sm"
                  label={`Ver pedidos (${unassigned})`}
                  onPress={() => router.push('/(professional)/queue')}
                />
              )}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: theme.colors.textPrimary },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
