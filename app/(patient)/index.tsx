import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useAction } from 'convex/react';
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

      <AnonymousAiButton />

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

function AnonymousAiButton() {
  const { colors } = useTheme();
  const respond = useAction(api.ai.assistant.respondAnonymous);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    // Discard everything when modal closes — that's the point of anonymous.
    setOpen(false);
    setQuery('');
    setAnswer(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (query.trim().length < 5) {
      setError('Escreve uma pergunta mais completa.');
      return;
    }
    setBusy(true);
    try {
      const r = await respond({ query: query.trim() });
      setAnswer(r.answer);
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        testID="anonymous-ai-open"
        onPress={() => setOpen(true)}
        style={{
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.primaryLight,
          borderWidth: 1,
          borderColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Text style={{ fontSize: 18 }}>✨</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{ ...typography.sm, fontWeight: '600', color: colors.primary }}
          >
            Pergunta anónima à AI
          </Text>
          <Text style={{ ...typography.xs, color: colors.text.secondary }}>
            Não fica guardado no teu histórico
          </Text>
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#0008',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background.primary,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.md,
              maxHeight: '85%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.lg,
                  fontWeight: '700',
                  color: colors.text.primary,
                }}
              >
                ✨ Pergunta anónima
              </Text>
              <Pressable testID="anonymous-ai-close" onPress={close}>
                <Text style={{ ...typography.lg, color: colors.text.secondary }}>×</Text>
              </Pressable>
            </View>
            <Text style={{ ...typography.xs, color: colors.text.secondary }}>
              Esta pergunta não é guardada na app, nem o teu histórico, nem é
              partilhada com um profissional. A resposta passa pelos mesmos
              validadores de segurança e é apenas informativa. Para casos
              urgentes liga 112 ou SNS 24 (808 24 24 24).
            </Text>

            {answer ? (
              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{
                  backgroundColor: colors.primaryLight,
                  padding: spacing.md,
                  borderRadius: radius.md,
                }}
              >
                <Text
                  style={{ ...typography.sm, color: colors.text.primary, lineHeight: 22 }}
                  selectable
                >
                  {answer}
                </Text>
              </ScrollView>
            ) : (
              <TextInput
                testID="anonymous-ai-input"
                multiline
                value={query}
                onChangeText={setQuery}
                placeholder="Escreve a tua pergunta..."
                placeholderTextColor={colors.text.secondary}
                style={{
                  ...typography.sm,
                  color: colors.text.primary,
                  backgroundColor: colors.background.secondary,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  minHeight: 120,
                  textAlignVertical: 'top',
                }}
              />
            )}

            {error && (
              <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
            )}

            {answer ? (
              <Pressable
                testID="anonymous-ai-done"
                onPress={close}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
                  Fechar (apaga tudo)
                </Text>
              </Pressable>
            ) : (
              <Pressable
                testID="anonymous-ai-submit"
                disabled={busy}
                onPress={submit}
                style={{
                  backgroundColor: busy ? colors.border : colors.primary,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.xs,
                }}
              >
                {busy && <ActivityIndicator color="#fff" size="small" />}
                <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
                  {busy ? 'A processar...' : 'Enviar'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
