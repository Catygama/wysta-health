import { useState } from 'react';
import { View, Text } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { priorityColors } from '@/constants/conversation';

// "Pedidos": requests for a professional that nobody has picked up yet. Once a
// professional assigns one to themselves it moves to their "Conversas" tab.

type Priority = 'urgent' | 'high' | 'medium' | 'low';
type PriorityFilter = Priority | 'all';
type Sort = 'oldest' | 'newest';

const SORT_LABELS: Record<Sort, string> = {
  oldest: 'Mais antigo',
  newest: 'Mais recente',
};

const PRIORITY_LABELS: Record<PriorityFilter, string> = {
  all: 'Todas',
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export default function Requests() {
  const [sort, setSort] = useState<Sort>('oldest');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const { theme } = useUnistyles();

  const requests = useQuery(api.conversations.listForProfessional, {
    scope: 'unassigned',
    priority: priority === 'all' ? undefined : priority,
  });

  // Urgency is handled by the priority filter; here the order is by time only.
  const sorted = [...(requests ?? [])].sort((a, b) =>
    sort === 'oldest' ? a._creationTime - b._creationTime : b._creationTime - a._creationTime
  );

  // From the theme so the dots stay legible in dark mode.
  const colors = priorityColors(theme.name);
  const priorityColor: Record<Priority, string> = {
    urgent: colors.urgent,
    high: colors.high,
    medium: colors.medium,
    low: colors.low,
  };

  const count = requests?.length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text testID="queue-count" style={styles.count}>
          {count === undefined
            ? ' '
            : count === 1
              ? '1 pedido por atribuir'
              : `${count} pedidos por atribuir`}
        </Text>

        <View style={styles.menus}>
          <DropdownMenu
            testID="queue-sort"
            label={SORT_LABELS[sort]}
            value={sort}
            onChange={setSort}
            options={(Object.keys(SORT_LABELS) as Sort[]).map((s) => ({
              value: s,
              label: SORT_LABELS[s],
            }))}
          />
          <DropdownMenu
            testID="queue-priority"
            label={`Prioridade: ${PRIORITY_LABELS[priority].toLowerCase()}`}
            value={priority}
            onChange={setPriority}
            options={(Object.keys(PRIORITY_LABELS) as PriorityFilter[]).map((p) => ({
              value: p,
              label: PRIORITY_LABELS[p],
              dotColor: p === 'all' ? undefined : priorityColor[p],
            }))}
          />
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
                {priority !== 'all'
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
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    gap: 2,
  },
  count: { fontSize: 13, color: theme.colors.textSecondary },
  menus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: theme.spacing.lg },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
