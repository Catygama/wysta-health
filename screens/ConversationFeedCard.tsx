import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TOPICS } from '@/constants/topics';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { relativeTime } from '@/lib/format';

export type FeedConversation = {
  _id: string;
  topic: string;
  preview: string | null;
  previewAt: number | null;
  responderName: string | null;
  isAiOnly: boolean;
};

// Patient-facing conversation card: who answers (professional, team or AI),
// topic and the latest visible message.
export function ConversationFeedCard({
  conversation,
  onPress,
}: {
  conversation: FeedConversation;
  onPress: () => void;
}) {
  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const isAi = conversation.isAiOnly;
  const name = conversation.responderName ?? (isAi ? 'Assistente Wysta' : 'Equipa Wysta');
  const initials = conversation.responderName
    ? conversation.responderName
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : isAi
      ? 'AI'
      : 'W';
  const tone = conversation.responderName ? 'lilac' : isAi ? 'mint' : 'ink';

  return (
    <Card
      testID={`patient-conversation-${conversation._id}`}
      onPress={onPress}
      style={styles.feedCard}
    >
      <Avatar initials={initials} tone={tone} size={44} />
      <View style={styles.feedBody}>
        <View style={styles.feedTop}>
          <Text style={styles.feedName} numberOfLines={1}>{name}</Text>
          {conversation.previewAt && (
            <Text style={styles.feedTime}>{relativeTime(conversation.previewAt)}</Text>
          )}
        </View>
        <Text style={styles.feedTopic}>{topic?.label ?? conversation.topic}</Text>
        {conversation.preview && (
          <Text style={styles.feedPreview} numberOfLines={1}>{conversation.preview}</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  feedCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  feedBody: { flex: 1, gap: 2 },
  feedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  feedName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, flex: 1 },
  feedTime: { fontSize: 12, color: theme.colors.textTertiary },
  feedTopic: { fontSize: 12, color: theme.colors.accent, fontWeight: '500' },
  feedPreview: { fontSize: 13, color: theme.colors.textSecondary },
}));
