import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { TOPICS } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';
import { spacing, typography, radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/constants/conversation';
import { relativeTime } from '@/lib/format';

export default function PatientHome() {
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const conversations = useQuery(api.conversations.listForPatient) ?? [];
  const { colors } = useTheme();
  const greeting = user?.profile?.displayName || user?.email?.split('@')[0] || 'utente';

  const latest = conversations[0];
  const activeCount = conversations.filter(
    (c) => c.status !== 'closed'
  ).length;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ gap: spacing.xs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Text
            style={{
              ...typography['2xl'],
              fontWeight: '700',
              color: colors.text.primary,
            }}
          >
            Olá, {greeting}
          </Text>
          <Icon
            name={{ sf: 'hand.wave.fill', ion: 'hand-left' }}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={{ ...typography.base, color: colors.text.secondary }}>
          Sobre o que precisas de ajuda hoje?
        </Text>
      </View>

      {latest && (
        <ContinueCard
          conversation={latest}
          activeCount={activeCount}
          onPress={() =>
            router.push({
              pathname: '/(patient)/conversations/[id]',
              params: { id: latest._id },
            })
          }
        />
      )}

      <EmergencyNotice />

      <View style={{ gap: spacing.md }}>
        <Text
          style={{
            ...typography.lg,
            fontWeight: '700',
            color: colors.text.primary,
          }}
        >
          Iniciar nova conversa
        </Text>
        <View style={{ gap: spacing.md }}>
          {TOPICS.map((topic) => (
            <Pressable
              key={topic.id}
              testID={`patient-topic-${topic.id}`}
              onPress={() =>
                router.push({
                  pathname: '/triage',
                  params: { topic: topic.id },
                })
              }
              style={({ pressed }) => ({
                backgroundColor: pressed
                  ? colors.background.tertiary
                  : colors.background.primary,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              })}
            >
              <Icon name={topic.icon} size={36} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.lg,
                    fontWeight: '600',
                    color: colors.text.primary,
                  }}
                >
                  {topic.label}
                </Text>
                <Text
                  style={{ ...typography.sm, color: colors.text.secondary }}
                >
                  {topic.description}
                </Text>
              </View>
              <Text style={{ color: colors.text.tertiary, fontSize: 20 }}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

type ContinueCardProps = {
  conversation: {
    topic: string;
    status: string;
    priority: string;
    lastMessageAt: number;
  };
  activeCount: number;
  onPress: () => void;
};

function ContinueCard({ conversation, activeCount, onPress }: ContinueCardProps) {
  const { colors } = useTheme();
  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const statusColor = STATUS_COLORS[conversation.status] ?? colors.text.secondary;
  const priorityColor = PRIORITY_COLORS[conversation.priority] ?? colors.text.secondary;
  return (
    <Pressable
      testID="patient-continue-card"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? colors.background.tertiary
          : colors.background.primary,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        gap: spacing.sm,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            ...typography.sm,
            fontWeight: '600',
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Continuar conversa
        </Text>
        <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
          {relativeTime(conversation.lastMessageAt)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {topic && <Icon name={topic.icon} size={28} color={colors.primary} />}
        <Text
          style={{
            ...typography.lg,
            fontWeight: '700',
            color: colors.text.primary,
          }}
        >
          {topic?.label ?? conversation.topic}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
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
            {STATUS_LABELS[conversation.status] ?? conversation.status}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: priorityColor + '15',
            paddingVertical: 2,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.full,
          }}
        >
          <Text
            style={{
              ...typography.xs,
              fontWeight: '600',
              color: priorityColor,
            }}
          >
            Prioridade {PRIORITY_LABELS[conversation.priority] ?? conversation.priority}
          </Text>
        </View>
        {activeCount > 1 && (
          <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
            +{activeCount - 1} ativa{activeCount - 1 === 1 ? '' : 's'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function EmergencyNotice() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: radius.md,
      }}
    >
      <Text
        style={{
          ...typography.xs,
          color: colors.text.tertiary,
          textAlign: 'center',
        }}
      >
        Em caso de emergência liga 112 ou SNS 24 (808 24 24 24). Este serviço não substitui uma urgência médica.
      </Text>
    </View>
  );
}
