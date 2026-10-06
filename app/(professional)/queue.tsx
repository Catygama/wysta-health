import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { FilterChip } from '@/components/ui/FilterChip';

// "Pedidos": requests for a professional that nobody has picked up yet. Once a
// professional assigns one to themselves it moves to their "Conversas" tab.

type Priority = 'urgent' | 'high' | 'medium' | 'low';
type Sort = 'urgency' | 'oldest' | 'newest';

const SORTS: { label: string; value: Sort }[] = [
  { label: 'Mais urgentes', value: 'urgency' },
  { label: 'Mais antigo', value: 'oldest' },
  { label: 'Mais recentes', value: 'newest' },
];

const PRIORITY_FILTERS: { label: string; value: Priority }[] = [
  { label: 'Urgente', value: 'urgent' },
  { label: 'Alta', value: 'high' },
  { label: 'Média', value: 'medium' },
  { label: 'Baixa', value: 'low' },
];

export default function Requests() {
  const [sort, setSort] = useState<Sort>('urgency');
  const [priority, setPriority] = useState<Priority | undefined>(undefined);
  const { theme } = useUnistyles();

  const requests = useQuery(api.conversations.listForProfessional, {
    scope: 'unassigned',
    priority,
  });

  // The backend already orders by priority, then recency.
  const sorted = [...(requests ?? [])];
  if (sort === 'oldest') sorted.sort((a, b) => a._creationTime - b._creationTime);
  if (sort === 'newest') sorted.sort((a, b) => b._creationTime - a._creationTime);

  // From the theme so the active chip stays legible in dark mode.
  const priorityColor: Record<Priority, string> = {
    urgent: theme.colors.danger,
    high: theme.colors.danger,
    medium: theme.colors.warning,
    low: theme.colors.success,
  };

  const count = requests?.length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {count !== undefined && (
          <Text testID="queue-count" style={styles.count}>
            {count === 0
              ? priority
                ? 'Sem pedidos com esta prioridade'
                : 'Sem pedidos por atribuir'
              : count === 1
                ? '1 pedido por atribuir'
                : `${count} pedidos por atribuir`}
          </Text>
        )}

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Ordenar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SORTS.map((s) => (
              <FilterChip
                key={s.value}
                testID={`queue-sort-${s.value}`}
                label={s.label}
                active={sort === s.value}
                onPress={() => setSort(s.value)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Prioridade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <FilterChip
              testID="queue-priority-all"
              label="Todas"
              active={priority === undefined}
              onPress={() => setPriority(undefined)}
            />
            {PRIORITY_FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                testID={`queue-priority-${f.value}`}
                label={f.label}
                accentColor={priorityColor[f.value]}
                active={priority === f.value}
                onPress={() => setPriority((cur) => (cur === f.value ? undefined : f.value))}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <ConversationList
        conversations={sorted as any}
        basePath="/(professional)/cases"
        showPriority
        // Nothing while loading, so a filter change doesn't flash the empty text.
        emptyComponent={
          requests === undefined ? null : (
            <View testID="queue-empty" style={styles.empty}>
              <Text style={styles.emptyText}>
                {priority
                  ? 'Nenhum pedido com esta prioridade.'
                  : 'Não há pedidos por atribuir. Os novos pedidos aparecem aqui.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.md,
  },
  count: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
  group: { gap: theme.spacing.xs },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { gap: theme.spacing.sm },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
