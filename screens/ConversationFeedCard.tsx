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
  onEnd,
  isLast,
}: {
  conversation: FeedConversation;
  onPress: () => void;
  /** Shows a button on the right that ends the conversation (after confirming). */
  onEnd?: () => void;
  /** Last row of the group: no divider under it. */
  isLast?: boolean;
}) {
  const { theme } = useUnistyles();
  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const pastel = theme.topic[topic?.color ?? 'general'];
  const who =
    conversation.responderName ?? (conversation.isAiOnly ? 'Assistente IA' : 'Enfermeiro/a');

  return (
    <View style={[styles.wrap, !isLast && styles.divider]}>
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
          {/* Not `preview &&`: an AI reply being prepared has an empty preview,
              and an empty string can't be a child of a View on web. */}
          {!!conversation.preview && (
            <Text style={styles.preview} numberOfLines={1}>
              {conversation.preview}
            </Text>
          )}
        </View>
      </Pressable>
      {onEnd && (
        <Pressable
          testID={`end-conversation-${conversation._id}`}
          accessibilityRole="button"
          accessibilityLabel="Terminar conversa"
          hitSlop={8}
          onPress={onEnd}
          style={({ pressed }) => [styles.endBtn, pressed && styles.pressed]}
        >
          <Icon name={{ sf: 'xmark.circle', ion: 'close-circle-outline' }} size={20} color={theme.colors.textSecondary} />
          <Text style={styles.endText}>Terminar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingRight: theme.spacing.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.sm,
  },
  endBtn: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 1 },
  endText: { fontSize: 11, fontWeight: '500', color: theme.colors.textSecondary },
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
