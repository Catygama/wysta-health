import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { TriageSummary } from '@/screens/TriageSummary';
import { EscalateSheet } from '@/screens/EscalateSheet';
import { Icon } from '@/components/ui/Icon';
import { TOPICS } from '@/constants/topics';
import { colors, spacing, typography, radius } from '@/constants/theme';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  ESCALATION_LEVEL_LABELS,
} from '@/constants/conversation';
import { useTabBar } from '@/contexts/TabBarContext';

export default function ProfessionalConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as any } : 'skip'
  );
  const messages = useQuery(
    api.messages.list,
    id ? { conversationId: id as any } : 'skip'
  );
  const assign = useMutation(api.conversations.assign);
  const close = useMutation(api.conversations.close);
  const { setIsTabBarHidden } = useTabBar();
  const [escalateOpen, setEscalateOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden])
  );

  if (!user || conversation === undefined || !id) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!conversation) return null;

  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const triageMessage = messages?.find((m) => m.metadata?.triageData);
  const canAssign =
    conversation.status === 'waiting' || !conversation.professionalId;
  const isMine = conversation.professionalId === user._id;
  const canClose = isMine && conversation.status !== 'closed';
  const canEscalate = isMine && conversation.status !== 'closed';

  const statusColor =
    STATUS_COLORS[conversation.status] ?? colors.text.secondary;
  const priorityColor =
    PRIORITY_COLORS[conversation.priority] ?? colors.text.secondary;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: topic?.label ?? 'Conversa' }} />
      <ScrollView
        style={{ flexGrow: 0, maxHeight: '45%' }}
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          {topic && (
            <Icon name={topic.icon} size={22} color={colors.primary} />
          )}
          <Text
            style={{
              ...typography.lg,
              fontWeight: '700',
              color: colors.text.primary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {topic?.label ?? conversation.topic}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          <Badge
            label={STATUS_LABELS[conversation.status] ?? conversation.status}
            color={statusColor}
          />
          <Badge
            label={`Prioridade ${PRIORITY_LABELS[conversation.priority] ?? conversation.priority}`}
            color={priorityColor}
          />
          {conversation.escalationLevel && (
            <Badge
              label={
                ESCALATION_LEVEL_LABELS[conversation.escalationLevel] ??
                conversation.escalationLevel
              }
              color={colors.danger as any}
            />
          )}
        </View>

        {conversation.patient && (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...typography.sm, color: colors.text.secondary }}>
              {conversation.patient.displayName ?? conversation.patient.email}
              {conversation.patient.ageRange
                ? ` • ${conversation.patient.ageRange}`
                : ''}
              {conversation.patient.location
                ? ` • ${conversation.patient.location}`
                : ''}
              {conversation.patient.pregnancyStatus
                ? ` • ${conversation.patient.pregnancyStatus}`
                : ''}
            </Text>
            {(conversation.patient.conditions?.length ?? 0) > 0 && (
              <Text
                style={{ ...typography.xs, color: colors.text.secondary }}
              >
                <Text style={{ fontWeight: '600' }}>Condições: </Text>
                {conversation.patient.conditions?.join(', ')}
              </Text>
            )}
            {(conversation.patient.medications?.length ?? 0) > 0 && (
              <Text
                style={{ ...typography.xs, color: colors.text.secondary }}
              >
                <Text style={{ fontWeight: '600' }}>Medicação: </Text>
                {conversation.patient.medications?.join(', ')}
              </Text>
            )}
          </View>
        )}

        {triageMessage?.metadata?.triageData && (
          <TriageSummary
            riskLevel={triageMessage.metadata.triageData.riskLevel}
            responses={triageMessage.metadata.triageData.responses ?? {}}
          />
        )}

        {conversation.escalationNotes && (
          <View
            style={{
              backgroundColor: colors.dangerLight,
              borderWidth: 1,
              borderColor: colors.danger,
              borderRadius: radius.md,
              padding: spacing.sm,
              gap: spacing.xs,
            }}
          >
            <Text
              style={{
                ...typography.xs,
                fontWeight: '700',
                color: colors.danger,
              }}
            >
              Notas de escalamento
            </Text>
            <Text
              style={{ ...typography.sm, color: colors.text.primary }}
            >
              {conversation.escalationNotes}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {canAssign && (
            <ActionButton
              label="Atribuir a mim"
              variant="primary"
              onPress={() => assign({ id: id as any })}
            />
          )}
          {canEscalate && (
            <ActionButton
              label="Escalar"
              variant="danger"
              onPress={() => setEscalateOpen(true)}
            />
          )}
          {canClose && (
            <ActionButton
              label="Encerrar"
              variant="secondary"
              onPress={() => close({ id: id as any })}
            />
          )}
        </View>
      </ScrollView>

      <View style={{ flex: 1 }}>
        <MessageThread
          conversationId={id}
          currentUserId={user._id}
          isProfessional
        />
      </View>

      <EscalateSheet
        visible={escalateOpen}
        conversationId={id}
        onClose={() => setEscalateOpen(false)}
      />
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        backgroundColor: color + '20',
        paddingVertical: 2,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.full,
      }}
    >
      <Text style={{ ...typography.xs, fontWeight: '700', color }}>
        {label}
      </Text>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  onPress: () => void;
};

function ActionButton({ label, variant, onPress }: ActionButtonProps) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : colors.background.tertiary;
  const fg = variant === 'secondary' ? colors.text.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: bg,
        opacity: pressed ? 0.85 : 1,
        borderRadius: radius.md,
        padding: spacing.sm,
        alignItems: 'center',
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.border,
      })}
    >
      <Text
        style={{
          ...typography.sm,
          fontWeight: '600',
          color: fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
