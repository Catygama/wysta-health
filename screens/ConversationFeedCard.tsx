import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TOPICS } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';
import { relativeTime } from '@/lib/format';

export type FeedConversation = {
  _id: string;
  topic: string;
  preview: string | null;
  previewAt: number | null;
  responderName: string | null;
  isAiOnly: boolean;
};

// Patient-facing conversation row (no box, like an inbox): topic icon, topic
// and who answers (professional, team or AI), the latest visible message.
export function ConversationFeedCard({
  conversation,
  onPress,
}: {
  conversation: FeedConversation;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const pastel = theme.topic[topic?.color ?? 'general'];
  const who =
    conversation.responderName ?? (conversation.isAiOnly ? 'Assistente IA' : 'Profissional de saúde');

  return (
    <Pressable
      testID={`patient-conversation-${conversation._id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: pastel.fill }]}>
        {topic && <Icon name={topic.icon} size={18} color={pastel.on} />}
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>
            {topic?.label ?? conversation.topic}
            <Text style={styles.who}> · {who}</Text>
          </Text>
          {conversation.previewAt && (
            <Text style={styles.time}>{relativeTime(conversation.previewAt)}</Text>
          )}
        </View>
        {conversation.preview && (
          <Text style={styles.preview} numberOfLines={1}>
            {conversation.preview}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  who: { fontWeight: '400', color: theme.colors.textSecondary },
  time: { fontSize: 12, color: theme.colors.textTertiary },
  preview: { fontSize: 14, color: theme.colors.textSecondary },
}));
