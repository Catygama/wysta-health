import { View, Text, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { TOPICS } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';

type Conversation = {
  _id: string;
  topic: string;
  title: string;
  status: string;
  lastMessageAt: number;
};

type Props = {
  conversations: Conversation[];
  basePath: string;
};

const STATUS_LABELS: Record<string, string> = {
  waiting: 'A aguardar',
  active: 'Em curso',
  escalated: 'Escalada',
  closed: 'Encerrada',
};

const STATUS_COLORS: Record<string, string> = {
  waiting: '#D97706',
  active: '#059669',
  escalated: '#DC2626',
  closed: '#6B7280',
};

export function ConversationList({ conversations, basePath }: Props) {
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
        return (
          <Pressable
            onPress={() =>
              router.push({ pathname: `${basePath}/[id]` as any, params: { id: item._id } })
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {topic && <Icon name={topic.icon} size={18} color={colors.primary} />}
                <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }}>
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
                <Text style={{ ...typography.xs, fontWeight: '600', color: statusColor }}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text style={{ ...typography.sm, color: colors.text.secondary }} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
