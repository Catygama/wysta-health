import { View, Text, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { TOPICS } from '@/constants/topics';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/constants/conversation';
import { Icon } from '@/components/ui/Icon';
import { relativeTime } from '@/lib/format';

type Conversation = {
  _id: string;
  topic: string;
  title: string;
  status: string;
  priority: string;
  lastMessageAt: number;
  professionalId?: string;
};

type Props = {
  conversations: Conversation[];
  basePath: string;
  showPriority?: boolean;
};

export function ConversationList({
  conversations,
  basePath,
  showPriority = false,
}: Props) {
  const router = useRouter();

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item }) => {
        const topic = TOPICS.find((t) => t.id === item.topic);
        const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
        const priorityColor = PRIORITY_COLORS[item.priority] ?? '#6B7280';
        return (
          <Pressable
            onPress={() =>
              router.push({
                pathname: `${basePath}/[id]` as any,
                params: { id: item._id },
              })
            }
            style={({ pressed }) => ({
              backgroundColor: pressed
                ? colors.background.tertiary
                : colors.background.primary,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.xs,
            })}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  flex: 1,
                }}
              >
                {topic && <Icon name={topic.icon} size={18} color={colors.primary} />}
                <Text
                  style={{
                    ...typography.base,
                    fontWeight: '600',
                    color: colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {topic?.label ?? item.topic}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: statusColor + '20',
                  paddingVertical: 2,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.full,
                }}
              >
                <Text
                  style={{
                    ...typography.xs,
                    fontWeight: '600',
                    color: statusColor,
                  }}
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text
              style={{ ...typography.sm, color: colors.text.secondary }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              {showPriority && item.priority && (
                <View
                  style={{
                    backgroundColor: priorityColor + '15',
                    paddingVertical: 1,
                    paddingHorizontal: spacing.xs,
                    borderRadius: radius.sm,
                  }}
                >
                  <Text
                    style={{
                      ...typography.xs,
                      fontWeight: '600',
                      color: priorityColor,
                    }}
                  >
                    {PRIORITY_LABELS[item.priority] ?? item.priority}
                  </Text>
                </View>
              )}
              <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
                {relativeTime(item.lastMessageAt)}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
