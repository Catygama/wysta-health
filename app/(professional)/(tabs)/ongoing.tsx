import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Button } from '@/components/ui/Button';
import { TabTitle } from '@/components/ui/TabTitle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// "Conversas": the professional's open conversations with patients (assigned
// to them). Closed conversations live in Perfil → Histórico.
export default function Ongoing() {
  const router = useRouter();
  const stats = useQuery(api.conversations.queueStats);
  const conversations = useQuery(api.conversations.listForProfessional, { scope: 'mine' });
  const close = useMutation(api.conversations.close);
  const [toEnd, setToEnd] = useState<string | null>(null);

  const unassigned = stats?.unassigned ?? 0;

  return (
    <View style={styles.root}>
      {/* The arrow goes to the Fila, the professional's main screen. */}
      <TabTitle title="Conversas" home="/(professional)/queue" />
      <ConversationList
        conversations={(conversations ?? []) as any}
        basePath="/(professional)/cases"
        showPriority
        onEnd={setToEnd}
        emptyComponent={
          conversations === undefined ? null : (
            <View testID="ongoing-empty" style={styles.empty}>
              <Text style={styles.emptyText}>Não tens conversas em curso.</Text>
              {unassigned > 0 && (
                <Button
                  testID="ongoing-empty-show-requests"
                  kind="primary"
                  size="sm"
                  label="Ver pedidos"
                  onPress={() => router.push('/(professional)/queue')}
                />
              )}
            </View>
          )
        }
      />
      <ConfirmDialog
        testID="close-conversation-dialog"
        visible={toEnd !== null}
        title="Tem a certeza que quer terminar a conversa?"
        message="A conversa passa para o Histórico e a utente deixa de poder enviar mensagens nela."
        confirmLabel="Terminar"
        onCancel={() => setToEnd(null)}
        onConfirm={async () => {
          if (toEnd) await close({ id: toEnd as any });
          setToEnd(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
