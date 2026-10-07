import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TOPICS } from '@/constants/topics';
import { PRIORITY_LABELS, priorityColors } from '@/constants/conversation';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { relativeTime } from '@/lib/format';
import { AlertLevelBadge } from '@/components/AlertLevelBadge';
import type { AlertLevel } from '@/convex/lib/alerts';

type Conversation = {
  _id: string;
  topic: string;
  title: string;
  status: string;
  priority: string;
  /** Triage alert level (professional queue). */
  alertLevel?: AlertLevel;
  lastMessageAt: number;
  professionalId?: string;
  /** Patient's display name (or email / "Utente convidada"). */
  patientName?: string;
  /** Latest visible message, for the preview line. */
  preview?: string | null;
  /** Professional request that started as a chat with the AI assistant. */
  fromAi?: boolean;
};

type Props = {
  conversations: Conversation[];
  basePath: string;
  showPriority?: boolean;
  /** Shown when the list is empty, so a filtered-out list doesn't look broken. */
  emptyComponent?: React.ReactElement | null;
  /** Shows a button on the right of each card that ends the conversation. */
  onEnd?: (id: string) => void;
};

// Professional lists (Fila, Conversas): the patient first, then what was said
// last, and topic / priority / origin as small labels.
export function ConversationList({
  conversations,
  basePath,
  showPriority = false,
  emptyComponent,
  onEnd,
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
        const priorityColor = priorityColors(theme.name)[item.priority] ?? theme.colors.textSecondary;
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
            <View style={styles.cardRow}>
              {/* Same topic icon as the patient's conversation list. */}
              <View style={[styles.topicIcon, { backgroundColor: pastel.fill }]}>
                {topic && <Icon name={topic.icon} size={18} color={pastel.on} />}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.top}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.patientName ?? 'Utente'}
                  </Text>
                  <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.preview ? `"${item.preview}"` : 'Questionário de triagem concluído'}
                </Text>
                <View style={styles.pills}>
                  {showPriority && item.alertLevel ? (
                    <AlertLevelBadge level={item.alertLevel} testID={`alert-level-${item._id}`} />
                  ) : null}
                  <View style={[styles.pill, styles.topicPill]}>
                    <Text style={styles.topicText}>{topic?.label ?? item.topic}</Text>
                  </View>
                  {showPriority && item.priority ? (
                    <View style={[styles.pill, { backgroundColor: priorityColor + (theme.name === 'dark' ? '29' : '18') }]}>
                      <Text style={[styles.pillText, { color: priorityColor }]}>
                        {PRIORITY_LABELS[item.priority] ?? item.priority}
                      </Text>
                    </View>
                  ) : null}
                  {item.fromAi ? (
                    <View style={[styles.pill, styles.topicPill]}>
                      <Icon name={{ sf: 'sparkles', ion: 'sparkles-outline' }} size={11} color={theme.colors.textSecondary} />
                      <Text style={styles.topicText}>Iniciada com a IA</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {onEnd && (
                <Pressable
                  testID={`end-conversation-${item._id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Terminar conversa"
                  hitSlop={8}
                  onPress={() => onEnd(item._id)}
                  style={({ pressed }) => [styles.endBtn, pressed && styles.pressed]}
                >
                  <Icon name={{ sf: 'xmark.circle', ion: 'close-circle-outline' }} size={22} color={theme.colors.textSecondary} />
                </Pressable>
              )}
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
  card: { gap: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardBody: { flex: 1, gap: 4 },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  top: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  time: { fontSize: 12, color: theme.colors.textTertiary },
  preview: { fontSize: 14, color: theme.colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  pillText: { fontSize: 12, fontWeight: '500' },
  topicPill: { backgroundColor: theme.colors.surfaceSunken },
  topicText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
}));
