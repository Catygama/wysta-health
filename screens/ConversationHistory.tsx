import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { TOPICS } from '@/constants/topics';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { relativeTime } from '@/lib/format';

// Perfil → Histórico: conversations that were ended (by the patient or a
// professional). Shared by both roles; the backend picks the right set.
export function ConversationHistory({ detailPath }: { detailPath: string }) {
  const conversations = useQuery(api.conversations.listHistory);
  const router = useRouter();
  const { theme } = useUnistyles();

  if (conversations !== undefined && conversations.length === 0) {
    return (
      <View testID="history-empty" style={styles.empty}>
        <Icon
          name={{ sf: 'clock.arrow.circlepath', ion: 'time-outline' }}
          size={32}
          color={theme.colors.textTertiary}
        />
        <Text style={styles.emptyText}>Ainda não tens conversas terminadas.</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="history-list"
      data={conversations ?? []}
      keyExtractor={(item) => item._id}
      style={styles.list}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item }) => {
        const topic = TOPICS.find((t) => t.id === item.topic);
        const pastel = theme.topic[topic?.color ?? 'general'];
        return (
          <Card
            testID={`history-row-${item._id}`}
            onPress={() => router.push({ pathname: detailPath as any, params: { id: item._id } })}
            style={styles.row}
          >
            {topic && (
              <View style={[styles.topicChip, { backgroundColor: pastel.fill }]}>
                <Icon name={topic.icon} size={18} color={pastel.on} />
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {topic?.label ?? item.topic}
              </Text>
              <Text style={styles.meta}>
                {item.isAiOnly ? 'Assistente AI' : 'Profissional'} · terminada{' '}
                {relativeTime(item.lastMessageAt)}
              </Text>
            </View>
            <Icon
              name={{ sf: 'chevron.right', ion: 'chevron-forward' }}
              size={16}
              color={theme.colors.textTertiary}
            />
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  topicChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 12, color: theme.colors.textSecondary },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
}));
