import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TOPICS } from '@/constants/topics';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/constants/conversation';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { relativeTime } from '@/lib/format';

type Conversation = {
  _id: string;
  topic: string;
  title: string;
  status: string;
  priority: string;
  lastMessageAt: number;
  professionalId?: string;
  /** Professional request that started as a chat with the AI assistant. */
  fromAi?: boolean;
};

type Props = {
  conversations: Conversation[];
  basePath: string;
  showPriority?: boolean;
  /** Status badge is professional-facing triage metadata; off for patients. */
  showStatus?: boolean;
  /** Shown when the list is empty, so a filtered-out list doesn't look broken. */
  emptyComponent?: React.ReactElement | null;
};

export function ConversationList({
  conversations,
  basePath,
  showPriority = false,
  showStatus = false,
  emptyComponent,
}: Props) {
  const router = useRouter();
  const { theme } = useUnistyles();

  return (
    <FlatList
      testID="conversations-list"
      data={conversations}
      keyExtractor={(item) => item._id}
      style={styles.list}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      ListEmptyComponent={emptyComponent}
      renderItem={({ item }) => {
        const topic = TOPICS.find((t) => t.id === item.topic);
        const pastel = theme.topic[topic?.color ?? 'general'];
        const statusColor = STATUS_COLORS[item.status] ?? theme.colors.textSecondary;
        const priorityColor =
          PRIORITY_COLORS[item.priority] ?? theme.colors.textSecondary;
        return (
          <Card
            testID={`conversation-row-${item._id}`}
            onPress={() =>
              router.push({
                pathname: `${basePath}/[id]` as any,
                params: { id: item._id },
              })
            }
            style={styles.card}
          >
            <View style={[styles.iconChip, { backgroundColor: pastel.fill }]}>
              {topic && <Icon name={topic.icon} size={20} color={pastel.on} />}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {topic?.label ?? item.topic}
                </Text>
                {showStatus ? (
                  <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.fromAi ? (
                <View style={styles.fromAi}>
                  <Icon name={{ sf: 'sparkles', ion: 'sparkles-outline' }} size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.fromAiText}>Vem de uma conversa com IA</Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                {showPriority && item.priority ? (
                  <View style={[styles.badge, { backgroundColor: priorityColor + '15' }]}>
                    <Text style={[styles.badgeText, { color: priorityColor }]}>
                      {PRIORITY_LABELS[item.priority] ?? item.priority}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text>
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  // Small top padding: the screens above the list already add their own spacing.
  content: { padding: theme.spacing.md, paddingTop: theme.spacing.xs, gap: theme.spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
  time: { fontSize: 12, color: theme.colors.textTertiary },
  fromAi: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fromAiText: { fontSize: 12, color: theme.colors.textSecondary },
}));
