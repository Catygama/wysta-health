import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Button } from '@/components/ui/Button';

// "Conversas": the professional's open conversations with patients (assigned
// to them). Closed conversations live in Perfil → Histórico.
export default function Ongoing() {
  const router = useRouter();
  const stats = useQuery(api.conversations.queueStats);
  const conversations = useQuery(api.conversations.listForProfessional, { scope: 'mine' });

  const unassigned = stats?.unassigned ?? 0;

  return (
    <View style={styles.root}>
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
  root: { flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.md },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
