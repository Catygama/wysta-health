import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { FilterChip } from '@/components/ui/FilterChip';
import { Button } from '@/components/ui/Button';

// "Conversas": the professional's open conversations with patients (assigned
// to them), plus cases where a colleague asked for a second opinion. Closed
// conversations live in Perfil → Histórico.

type Scope = 'mine' | 'review';

export default function Ongoing() {
  const [scope, setScope] = useState<Scope>('mine');
  const router = useRouter();
  const stats = useQuery(api.conversations.queueStats);
  const conversations = useQuery(api.conversations.listForProfessional, { scope });

  const unassigned = stats?.unassigned ?? 0;

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip
          testID="ongoing-scope-mine"
          label={stats ? `Minhas (${stats.mine})` : 'Minhas'}
          active={scope === 'mine'}
          onPress={() => setScope('mine')}
        />
        <FilterChip
          testID="ongoing-scope-review"
          label={stats ? `Para revisão (${stats.review})` : 'Para revisão'}
          active={scope === 'review'}
          onPress={() => setScope('review')}
        />
      </ScrollView>

      <ConversationList
        conversations={(conversations ?? []) as any}
        basePath="/(professional)/cases"
        showPriority
        showStatus
        emptyComponent={
          conversations === undefined ? null : (
            <View testID="ongoing-empty" style={styles.empty}>
              <Text style={styles.emptyText}>
                {scope === 'mine'
                  ? 'Não tens conversas em curso.'
                  : 'Nenhum pedido de 2ª opinião.'}
              </Text>
              {scope === 'mine' && unassigned > 0 && (
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
  chipScroll: { flexGrow: 0 },
  chipRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
