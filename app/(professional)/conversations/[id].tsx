import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { TriageSummary } from '@/screens/TriageSummary';
import { Icon } from '@/components/ui/Icon';
import { TOPICS } from '@/constants/topics';
import { spacing, typography, radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/constants/conversation';
import { useTabBar } from '@/contexts/TabBarContext';

type Tab = 'chat' | 'internal' | 'summary';

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
  const markUrgent = useMutation(api.conversations.markUrgent);
  const requestReview = useMutation(api.conversations.requestReview);
  const clearReview = useMutation(api.conversations.clearReview);
  const recommendInPerson = useMutation(api.conversations.recommendInPerson);
  const { setIsTabBarHidden } = useTabBar();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [redirectOpen, setRedirectOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const { colors } = useTheme();

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
  const isMine = conversation.professionalId === user._id;
  const isClosed = conversation.status === 'closed';
  const canAssign = !isMine && !isClosed;
  const isAssignedToOther = !!conversation.professionalId && !isMine;
  const canClose = isMine && !isClosed;
  const canEscalate = isMine && !isClosed;

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
          {conversation.needsReview && (
            <Badge
              label="Para revisão"
              color={colors.warning as any}
            />
          )}
          <Badge
            label={isMine ? 'Atribuída a si' : 'Não atribuída a si'}
            color={isMine ? (colors.success as any) : colors.text.tertiary as any}
          />
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
            <UserSummaryBanner
              patientId={conversation.patientId}
              aiSummary={conversation.patient.aiSummary}
              aiSummaryAt={conversation.patient.aiSummaryAt}
            />
          </View>
        )}

        {triageMessage?.metadata?.triageData && (
          <TriageSummary
            riskLevel={triageMessage.metadata.triageData.riskLevel}
            responses={triageMessage.metadata.triageData.responses ?? {}}
          />
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {canAssign && (
            <ActionButton
              testID="conversation-assign-button"
              label={isAssignedToOther ? 'Assumir conversa' : 'Atribuir a mim'}
              variant="primary"
              onPress={() => assign({ id: id as any })}
            />
          )}
          {canEscalate && conversation.priority !== 'urgent' && (
            <ActionButton
              testID="conversation-mark-urgent"
              label="Aumentar prioridade"
              variant="danger"
              onPress={() => markUrgent({ id: id as any })}
            />
          )}
          {canEscalate && !conversation.needsReview && (
            <ActionButton
              testID="conversation-request-review"
              label="Pedir 2ª opinião"
              variant="secondary"
              onPress={() => setReviewOpen(true)}
            />
          )}
          {canEscalate && conversation.needsReview && (
            <ActionButton
              testID="conversation-clear-review"
              label="Marcar revisão concluída"
              variant="secondary"
              onPress={() => clearReview({ id: id as any })}
            />
          )}
          {canEscalate && (
            <ActionButton
              testID="conversation-recommend-in-person"
              label="Recomendar presencial"
              variant="secondary"
              onPress={() => setRedirectOpen(true)}
            />
          )}
          {canClose && (
            <ActionButton
              testID="conversation-close-button"
              label="Encerrar"
              variant="secondary"
              onPress={() => close({ id: id as any })}
            />
          )}
        </View>
        {conversation.needsReview && conversation.reviewQuestion && (
          <View
            style={{
              backgroundColor: colors.warningLight,
              borderWidth: 1,
              borderColor: colors.warning,
              borderRadius: radius.md,
              padding: spacing.sm,
              gap: 2,
            }}
          >
            <Text style={{ ...typography.xs, fontWeight: '700', color: colors.warning }}>
              Pedido de 2ª opinião
            </Text>
            <Text style={{ ...typography.sm, color: colors.text.primary }}>
              {conversation.reviewQuestion}
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.background.secondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TabButton
          testID="thread-tab-chat"
          label="Chat"
          active={tab === 'chat'}
          onPress={() => setTab('chat')}
        />
        <TabButton
          testID="thread-tab-internal"
          label="Notas internas"
          active={tab === 'internal'}
          onPress={() => setTab('internal')}
        />
        <TabButton
          testID="thread-tab-summary"
          label="Sumário"
          active={tab === 'summary'}
          onPress={() => setTab('summary')}
        />
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'summary' ? (
          <SummaryPanel
            conversationId={id}
            triage={triageMessage?.metadata?.triageData}
            messageCount={messages?.length ?? 0}
            aiSummary={conversation.aiSummary}
            aiSummaryAt={conversation.aiSummaryAt}
            canGenerate={isMine && !!messages && messages.length > 0}
          />
        ) : (
          <MessageThread
            conversationId={id}
            currentUserId={user._id}
            isProfessional
            scope={tab === 'internal' ? 'internal' : 'chat'}
            canSend={isMine}
            closed={isClosed}
          />
        )}
      </View>

      <RequestReviewSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={async (question) => {
          await requestReview({ id: id as any, question });
        }}
      />
      <RecommendInPersonSheet
        visible={redirectOpen}
        onClose={() => setRedirectOpen(false)}
        onSubmit={async (extraNote, alsoClose) => {
          await recommendInPerson({ id: id as any, extraNote, alsoClose });
        }}
      />
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        // Tail "20" is the alpha-channel hex for ~12% opacity. The badge color
        // is passed in (status/priority/escalation) and reads fine in either
        // theme — no useTheme() needed.
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

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
};

function TabButton({ label, active, onPress, testID }: TabButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.primary : 'transparent',
      }}
    >
      <Text
        style={{
          ...typography.sm,
          fontWeight: active ? '700' : '500',
          color: active ? colors.primary : colors.text.secondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryPanel({
  conversationId,
  triage,
  messageCount,
  aiSummary,
  aiSummaryAt,
  canGenerate,
}: {
  conversationId: string;
  triage?: { topic: string; responses: Record<string, unknown>; riskLevel: string };
  messageCount: number;
  aiSummary?: string;
  aiSummaryAt?: number;
  canGenerate: boolean;
}) {
  const { colors } = useTheme();
  const generate = useAction(api.ai.chatSummary.generate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      await generate({ conversationId: conversationId as any });
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao gerar sumário');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {triage && (
        <TriageSummary
          riskLevel={triage.riskLevel}
          responses={triage.responses ?? {}}
        />
      )}
      <View
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.xs,
        }}
      >
        <Text style={{ ...typography.sm, fontWeight: '600', color: colors.text.primary }}>
          Estatísticas da conversa
        </Text>
        <Text style={{ ...typography.sm, color: colors.text.secondary }}>
          Mensagens: {messageCount}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.primaryLight,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.sm, fontWeight: '600', color: colors.primary }}>
            Sumário AI
          </Text>
          {aiSummaryAt && (
            <Text style={{ ...typography.xs, color: colors.text.secondary }}>
              {new Date(aiSummaryAt).toLocaleString('pt-PT')}
            </Text>
          )}
        </View>

        {aiSummary ? (
          <Text style={{ ...typography.sm, color: colors.text.primary, lineHeight: 22 }}>
            {aiSummary}
          </Text>
        ) : (
          <Text style={{ ...typography.sm, color: colors.text.secondary }}>
            Ainda sem sumário. Gera um resumo clínico desta conversa com AI.
          </Text>
        )}

        {error && (
          <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
        )}

        <Pressable
          testID="generate-ai-summary-button"
          disabled={!canGenerate || busy}
          onPress={onGenerate}
          style={{
            backgroundColor: canGenerate && !busy ? colors.primary : colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xs,
          }}
        >
          {busy && <ActivityIndicator color="#fff" size="small" />}
          <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
            {busy ? 'A gerar...' : aiSummary ? 'Re-gerar sumário' : 'Gerar sumário AI'}
          </Text>
        </Pressable>

        {!canGenerate && !busy && (
          <Text style={{ ...typography.xs, color: colors.text.secondary }}>
            Atribui-te a conversa e aguarda mensagens antes de gerar.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

type ActionButtonProps = {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  onPress: () => void;
  testID?: string;
};

function ActionButton({ label, variant, onPress, testID }: ActionButtonProps) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : colors.background.tertiary;
  const fg = variant === 'secondary' ? colors.text.primary : '#fff';
  return (
    <Pressable
      testID={testID}
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


function UserSummaryBanner({
  patientId,
  aiSummary,
  aiSummaryAt,
}: {
  patientId: any;
  aiSummary?: string;
  aiSummaryAt?: number;
}) {
  const { colors } = useTheme();
  const generate = useAction(api.ai.userSummary.generate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      await generate({ patientId });
    } catch (e: any) {
      setError(e?.message ?? "Falha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        marginTop: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.background.secondary,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ ...typography.xs, fontWeight: "700", color: colors.primary }}>
          Perfil AI da utente
        </Text>
        {aiSummaryAt && (
          <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
            {new Date(aiSummaryAt).toLocaleDateString("pt-PT")}
          </Text>
        )}
      </View>
      {aiSummary ? (
        <Text style={{ ...typography.xs, color: colors.text.primary, lineHeight: 18 }}>
          {aiSummary}
        </Text>
      ) : (
        <Text style={{ ...typography.xs, color: colors.text.secondary }}>
          Sem perfil gerado.
        </Text>
      )}
      {error && (
        <Text style={{ ...typography.xs, color: colors.danger }}>{error}</Text>
      )}
      <Pressable
        testID="generate-user-summary-button"
        disabled={busy}
        onPress={onGenerate}
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: radius.sm,
          backgroundColor: busy ? colors.border : colors.primary,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        {busy && <ActivityIndicator color="#fff" size="small" />}
        <Text style={{ ...typography.xs, fontWeight: "600", color: "#fff" }}>
          {busy ? "A gerar..." : aiSummary ? "Atualizar" : "Gerar perfil AI"}
        </Text>
      </Pressable>
    </View>
  );
}

function RequestReviewSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (question: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (question.trim().length < 5) {
      setError('Descreve a dúvida em pelo menos 5 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(question.trim());
      setQuestion('');
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.background.primary,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ ...typography.lg, fontWeight: '700', color: colors.text.primary }}>
              Pedir 2ª opinião
            </Text>
            <Pressable testID="review-close" onPress={onClose}>
              <Text style={{ ...typography.lg, color: colors.text.secondary }}>×</Text>
            </Pressable>
          </View>
          <Text style={{ ...typography.xs, color: colors.text.secondary }}>
            Descreve a dúvida clínica. A pergunta vai para notas internas e a
            conversa aparece no filtro "Para revisão" para os colegas.
          </Text>
          <TextInput
            testID="review-question-input"
            multiline
            value={question}
            onChangeText={setQuestion}
            placeholder="Qual é a dúvida? Que tipo de input procuras?"
            placeholderTextColor={colors.text.secondary}
            style={{
              ...typography.sm,
              color: colors.text.primary,
              backgroundColor: colors.background.secondary,
              borderRadius: radius.md,
              padding: spacing.sm,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
          {error && <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>}
          <Pressable
            testID="review-submit"
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
              {busy ? 'A pedir...' : 'Pedir revisão'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RecommendInPersonSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (extraNote: string | undefined, alsoClose: boolean) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [extraNote, setExtraNote] = useState('');
  const [alsoClose, setAlsoClose] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await onSubmit(extraNote.trim() || undefined, alsoClose);
      setExtraNote('');
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.background.primary,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ ...typography.lg, fontWeight: '700', color: colors.text.primary }}>
              Recomendar consulta presencial
            </Text>
            <Pressable testID="redirect-close" onPress={onClose}>
              <Text style={{ ...typography.lg, color: colors.text.secondary }}>×</Text>
            </Pressable>
          </View>
          <View
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: radius.md,
              padding: spacing.sm,
              gap: 4,
            }}
          >
            <Text style={{ ...typography.xs, fontWeight: '600', color: colors.text.secondary }}>
              Mensagem que a utente vai receber
            </Text>
            <Text style={{ ...typography.sm, color: colors.text.primary, lineHeight: 20 }}>
              Pelo que descreves, recomendamos que procures consulta presencial nos teus cuidados primários ou liga ao SNS 24 (808 24 24 24). Se for uma situação urgente, liga 112.
            </Text>
          </View>
          <TextInput
            testID="redirect-extra-note"
            multiline
            value={extraNote}
            onChangeText={setExtraNote}
            placeholder="Nota adicional para a utente (opcional)"
            placeholderTextColor={colors.text.secondary}
            style={{
              ...typography.sm,
              color: colors.text.primary,
              backgroundColor: colors.background.secondary,
              borderRadius: radius.md,
              padding: spacing.sm,
              minHeight: 60,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Switch
              testID="redirect-also-close"
              value={alsoClose}
              onValueChange={setAlsoClose}
              thumbColor={alsoClose ? colors.primary : colors.text.tertiary}
            />
            <Text style={{ ...typography.sm, color: colors.text.primary }}>
              Encerrar a conversa após enviar
            </Text>
          </View>
          {error && <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>}
          <Pressable
            testID="redirect-submit"
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
              {busy ? 'A enviar...' : 'Enviar mensagem'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
