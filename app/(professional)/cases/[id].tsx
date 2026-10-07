import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  PanResponder,
  Platform,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { AiContextBlock } from '@/screens/AiContextBlock';
import { TriageSummary } from '@/screens/TriageSummary';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TOPICS } from '@/constants/topics';
import { fonts } from '@/lib/fonts';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/constants/conversation';
import { useTabBar } from '@/contexts/TabBarContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { pregnancyClinicalLabel } from '@/constants/profile';
import type { AlertLevel } from '@/convex/lib/alerts';

type Tab = 'chat' | 'internal' | 'summary';

export default function ProfessionalConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(api.conversations.get, id ? { id: id as any } : 'skip');
  const messages = useQuery(api.messages.list, id ? { conversationId: id as any } : 'skip');
  const assign = useMutation(api.conversations.assign);
  const close = useMutation(api.conversations.close);
  const markUrgent = useMutation(api.conversations.markUrgent);
  const recommendInPerson = useMutation(api.conversations.recommendInPerson);
  const { setIsTabBarHidden } = useTabBar();
  const [redirectOpen, setRedirectOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const { theme } = useUnistyles();

  // Draggable split between the case details (top) and the chat (bottom).
  // null = default size (up to 45% of the screen) until the divider is dragged.
  const [headHeight, setHeadHeight] = useState<number | null>(null);
  const headHeightRef = useRef(0);
  const bodyHeightRef = useRef(0);
  const maxHeadRef = useRef(0);
  const dragStartRef = useRef(0);
  const splitResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartRef.current = headHeightRef.current;
        // The details can take whatever the chat body has beyond its minimum.
        maxHeadRef.current = Math.max(0, headHeightRef.current + bodyHeightRef.current - MIN_THREAD_HEIGHT);
      },
      onPanResponderMove: (_, g) => {
        setHeadHeight(Math.min(Math.max(dragStartRef.current + g.dy, 0), maxHeadRef.current));
      },
    })
  ).current;

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden])
  );

  if (!user || conversation === undefined || !id) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }

  if (!conversation) return null;

  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const pastel = theme.topic[topic?.color ?? 'general'];
  const triageMessage = messages?.find((m) => m.metadata?.triageData);
  const isMine = conversation.professionalId === user._id;
  const isClosed = conversation.status === 'closed';
  const isAiOnly = conversation.kind === 'ai-only';
  // Chats with the AI are read-only context, never assigned.
  const canAssign = !isMine && !isClosed && !isAiOnly;
  const isAssignedToOther = !!conversation.professionalId && !isMine;
  const canClose = isMine && !isClosed;
  const canEscalate = isMine && !isClosed;
  const openRelated = (relatedId: string) =>
    router.push({ pathname: '/(professional)/cases/[id]', params: { id: relatedId } });

  const statusColor = STATUS_COLORS[conversation.status] ?? theme.colors.textSecondary;
  const priorityColor = PRIORITY_COLORS[conversation.priority] ?? theme.colors.textSecondary;

  return (
    <View style={styles.root}>
      {/* The topic is already the body heading; the header names the patient. */}
      <Stack.Screen
        options={{
          title:
            conversation.patient?.displayName ?? conversation.patient?.email ?? topic?.label ?? 'Conversa',
        }}
      />
      <ScrollView
        style={[styles.headScroll, headHeight !== null && { height: headHeight, maxHeight: undefined }]}
        contentContainerStyle={styles.head}
      >
        <View style={styles.topicRow}>
          {topic && (
            <View style={[styles.topicChip, { backgroundColor: pastel.fill }]}>
              <Icon name={topic.icon} size={18} color={pastel.on} />
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {topic?.label ?? conversation.topic}
          </Text>
        </View>

        <View style={styles.badges}>
          <Badge label={STATUS_LABELS[conversation.status] ?? conversation.status} color={statusColor} />
          <Badge
            label={`Prioridade ${PRIORITY_LABELS[conversation.priority] ?? conversation.priority}`}
            color={priorityColor}
          />
          <Badge
            label={isMine ? 'Atribuída a si' : 'Não atribuída a si'}
            color={isMine ? theme.colors.success : theme.colors.textTertiary}
          />
        </View>

        {conversation.patient && (
          <View style={styles.patient}>
            <Text style={styles.patientLine}>
              {conversation.patient.displayName ?? conversation.patient.email}
              {conversation.patient.ageRange ? ` • ${conversation.patient.ageRange}` : ''}
              {conversation.patient.location ? ` • ${conversation.patient.location}` : ''}
              {conversation.patient.pregnancyStatus
                ? ` • ${pregnancyClinicalLabel(conversation.patient.pregnancyStatus)}`
                : ''}
            </Text>
            {(conversation.patient.conditions?.length ?? 0) > 0 && (
              <Text style={styles.patientMeta}>
                <Text style={styles.patientMetaStrong}>Condições: </Text>
                {conversation.patient.conditions?.join(', ')}
              </Text>
            )}
            {(conversation.patient.medications?.length ?? 0) > 0 && (
              <Text style={styles.patientMeta}>
                <Text style={styles.patientMetaStrong}>Medicação: </Text>
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
            alertLevel={conversation.alertLevel}
            responses={triageMessage.metadata.triageData.responses ?? {}}
          />
        )}

        <View style={styles.actions}>
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
              onPress={() => setConfirmClose(true)}
            />
          )}
        </View>
        {/* Chats with the AI show inside the chat tab (AiContextBlock). */}
        {conversation.contextConversation && conversation.contextConversation.kind !== 'ai-only' && (
          <RelatedLink
            testID="related-context-conversation"
            text="Esta conversa tem contexto de uma conversa anterior com profissional."
            action="Ver conversa anterior"
            onPress={() => openRelated(conversation.contextConversation!._id)}
          />
        )}
      </ScrollView>

      <View
        {...splitResponder.panHandlers}
        // The handle sits right under the details, so its y is their height.
        onLayout={(e) => (headHeightRef.current = e.nativeEvent.layout.y)}
        style={[styles.splitHandle, Platform.OS === 'web' && (WEB_ROW_RESIZE as object)]}
        accessibilityLabel="Arrastar para ajustar o tamanho do chat"
        testID="case-split-handle"
      >
        <View style={styles.splitGrip} />
      </View>

      <View style={styles.tabBar}>
        <TabButton testID="thread-tab-chat" label="Chat" active={tab === 'chat'} onPress={() => setTab('chat')} />
        <TabButton testID="thread-tab-internal" label="Notas internas" active={tab === 'internal'} onPress={() => setTab('internal')} />
        <TabButton testID="thread-tab-summary" label="Sumário" active={tab === 'summary'} onPress={() => setTab('summary')} />
      </View>

      <View style={styles.body} onLayout={(e) => (bodyHeightRef.current = e.nativeEvent.layout.height)}>
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
            header={tab === 'chat' ? <AiContextBlock conversationId={id} /> : null}
          />
        )}
      </View>

      <ConfirmDialog
        testID="close-conversation-dialog"
        visible={confirmClose}
        title="Tem a certeza que quer terminar a conversa?"
        message="A conversa passa para o Histórico e a utente deixa de poder enviar mensagens nela."
        confirmLabel="Terminar"
        onCancel={() => setConfirmClose(false)}
        onConfirm={async () => {
          await close({ id: id as any });
          setConfirmClose(false);
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

function RelatedLink({
  testID,
  text,
  action,
  onPress,
}: {
  testID: string;
  text: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.relatedBanner}>
      <Text style={styles.relatedText}>{text}</Text>
      <Text style={styles.relatedAction}>{action} →</Text>
    </Pressable>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

type TabButtonProps = { label: string; active: boolean; onPress: () => void; testID?: string };

function TabButton({ label, active, onPress, testID }: TabButtonProps) {
  styles.useVariants({ active });
  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.tab}
    >
      <Text style={styles.tabText}>{label}</Text>
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
  triage?: { topic: string; responses: Record<string, unknown>; riskLevel: string; alertLevel?: AlertLevel };
  messageCount: number;
  aiSummary?: string;
  aiSummaryAt?: number;
  canGenerate: boolean;
}) {
  const { theme } = useUnistyles();
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

  const genDisabled = !canGenerate || busy;

  return (
    <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summary} contentInsetAdjustmentBehavior="automatic">
      {triage && <TriageSummary riskLevel={triage.riskLevel} alertLevel={triage.alertLevel} responses={triage.responses ?? {}} />}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Estatísticas da conversa</Text>
        <Text style={styles.statsLine}>Mensagens: {messageCount}</Text>
      </View>

      <View style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiTitle}>Sumário AI</Text>
          {aiSummaryAt && <Text style={styles.aiDate}>{new Date(aiSummaryAt).toLocaleString('pt-PT')}</Text>}
        </View>

        {aiSummary ? (
          <Text style={styles.aiBody}>{aiSummary}</Text>
        ) : (
          <Text style={styles.aiEmpty}>Ainda sem sumário. Gera um resumo clínico desta conversa com AI.</Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          testID="generate-ai-summary-button"
          disabled={genDisabled}
          onPress={onGenerate}
          style={[styles.genBtn, genDisabled ? styles.genBtnOff : styles.genBtnOn]}
        >
          {busy && <ActivityIndicator color={theme.colors.onInk} size="small" />}
          <Text style={[styles.genBtnText, genDisabled && styles.genBtnTextOff]}>
            {busy ? 'A gerar...' : aiSummary ? 'Re-gerar sumário' : 'Gerar sumário AI'}
          </Text>
        </Pressable>

        {!canGenerate && !busy && (
          <Text style={styles.aiEmpty}>Atribui-te a conversa e aguarda mensagens antes de gerar.</Text>
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
  styles.useVariants({ kind: variant });
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.dim]}>
      <Text style={styles.actionText}>{label}</Text>
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
  const { theme } = useUnistyles();
  const generate = useAction(api.ai.userSummary.generate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      await generate({ patientId });
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.usbCard}>
      <View style={styles.usbHeader}>
        <Text style={styles.usbTitle}>Perfil clínico (AI)</Text>
        {aiSummaryAt && <Text style={styles.usbDate}>{new Date(aiSummaryAt).toLocaleDateString('pt-PT')}</Text>}
      </View>
      {aiSummary ? (
        <Text style={styles.usbBody}>{aiSummary}</Text>
      ) : (
        <Text style={styles.usbEmpty}>Sem perfil gerado.</Text>
      )}
      {error && <Text style={styles.errorXs}>{error}</Text>}
      <Pressable
        testID="generate-user-summary-button"
        disabled={busy}
        onPress={onGenerate}
        style={[styles.usbBtn, busy && styles.usbBtnOff]}
      >
        {busy && <ActivityIndicator color={theme.colors.onInk} size="small" />}
        <Text style={styles.usbBtnText}>{busy ? 'A gerar...' : aiSummary ? 'Atualizar' : 'Gerar perfil AI'}</Text>
      </Pressable>
    </View>
  );
}

function SheetHeader({ title, onClose, closeTestID }: { title: string; onClose: () => void; closeTestID: string }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Pressable testID={closeTestID} onPress={onClose} hitSlop={8}>
        <Icon name={{ sf: 'xmark', ion: 'close' } as IconName} size={22} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
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
  const { theme } = useUnistyles();
  const [extraNote, setExtraNote] = useState('');
  // Off by default: closing is a deliberate choice, not a side effect.
  const [alsoClose, setAlsoClose] = useState(false);
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
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <SheetHeader title="Recomendar consulta presencial" onClose={onClose} closeTestID="redirect-close" />
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Pré-visualização da mensagem</Text>
            <Text style={styles.previewText}>
              Pelo que descreves, recomendamos que procures consulta presencial nos teus
              cuidados primários ou liga ao SNS 24 (808 24 24 24). Se for uma situação
              urgente, liga 112.
            </Text>
          </View>
          <TextInput
            testID="redirect-extra-note"
            multiline
            value={extraNote}
            onChangeText={setExtraNote}
            placeholder="Nota adicional (opcional)"
            placeholderTextColor={theme.colors.textTertiary as any}
            style={styles.sheetInputShort}
          />
          <View style={styles.switchRow}>
            <Switch
              testID="redirect-also-close"
              value={alsoClose}
              onValueChange={setAlsoClose}
              thumbColor={alsoClose ? theme.colors.ink : theme.colors.textTertiary}
            />
            <Text style={styles.switchLabel}>Encerrar a conversa após enviar</Text>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable testID="redirect-submit" disabled={busy} onPress={submit} style={[styles.sheetCta, busy && styles.dim]}>
            {busy && <ActivityIndicator color={theme.colors.onInk} size="small" />}
            <Text style={styles.sheetCtaText}>{busy ? 'A enviar...' : 'Enviar mensagem'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Room always left for the chat body (messages + composer) when dragging down.
const MIN_THREAD_HEIGHT = 200;
// Web-only cursor/selection props, not in RN's style types.
const WEB_ROW_RESIZE = { cursor: 'row-resize', userSelect: 'none', touchAction: 'none' };

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  root: { flex: 1, backgroundColor: theme.colors.background },
  headScroll: { flexGrow: 0, maxHeight: '45%' },
  splitHandle: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  splitGrip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  head: { padding: theme.spacing.md, gap: theme.spacing.sm },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  topicChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.inkText, flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  badge: { paddingVertical: 2, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.pill },
  badgeText: { fontSize: 12, fontWeight: '500' },
  patient: { gap: theme.spacing.xs },
  patientLine: { fontSize: 14, color: theme.colors.textSecondary },
  patientMeta: { fontSize: 12, color: theme.colors.textSecondary },
  patientMetaStrong: { fontWeight: '500' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  relatedBanner: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    gap: 2,
  },
  relatedTitle: { fontSize: 12, fontWeight: '500', color: theme.colors.ink },
  relatedText: { fontSize: 13, color: theme.colors.textPrimary },
  relatedAction: { fontSize: 13, fontWeight: '500', color: theme.colors.accent },
  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.background },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    variants: {
      active: {
        true: { borderBottomColor: theme.colors.inkText },
        false: { borderBottomColor: 'transparent' },
      },
    },
  },
  tabText: {
    fontSize: 14,
    variants: {
      active: {
        true: { color: theme.colors.inkText, fontWeight: '500' },
        false: { color: theme.colors.textSecondary, fontWeight: '500' },
      },
    },
  },
  body: { flex: 1 },
  // Action buttons
  action: {
    flex: 1,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    variants: {
      kind: {
        primary: { backgroundColor: theme.colors.ink },
        danger: { backgroundColor: theme.colors.danger },
        secondary: { backgroundColor: theme.colors.surface },
      },
    },
  },
  dim: { opacity: 0.85 },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    variants: {
      kind: {
        primary: { color: theme.colors.onInk },
        danger: { color: theme.colors.onInk },
        secondary: { color: theme.colors.textPrimary },
      },
    },
  },
  // Summary panel
  summaryScroll: { flex: 1, backgroundColor: theme.colors.background },
  summary: { padding: theme.spacing.lg, gap: theme.spacing.md },
  statsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  statsTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: theme.colors.textPrimary },
  statsLine: { fontSize: 14, color: theme.colors.textSecondary },
  aiCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderLeftWidth: 3,
    borderLeftColor: theme.topic.intimate.fill,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: theme.topic.intimate.on },
  aiDate: { fontSize: 12, color: theme.colors.textSecondary },
  aiBody: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
  aiEmpty: { fontSize: 14, color: theme.colors.textSecondary },
  error: { fontSize: 14, color: theme.colors.danger },
  errorXs: { fontSize: 12, color: theme.colors.danger },
  genBtn: {
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  genBtnOn: { backgroundColor: theme.colors.ink },
  genBtnOff: { backgroundColor: theme.colors.surfaceSunken },
  genBtnText: { fontSize: 14, fontWeight: '500', color: theme.colors.onInk },
  genBtnTextOff: { color: theme.colors.textTertiary },
  // UserSummaryBanner
  usbCard: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: theme.topic.intimate.fill,
    gap: theme.spacing.xs,
  },
  usbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usbTitle: { fontSize: 12, fontWeight: '500', color: theme.topic.intimate.on },
  usbDate: { fontSize: 12, color: theme.colors.textTertiary },
  usbBody: { fontSize: 12, color: theme.colors.textPrimary, lineHeight: 18 },
  usbEmpty: { fontSize: 12, color: theme.colors.textSecondary },
  usbBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  usbBtnOff: { opacity: 0.7 },
  usbBtnText: { fontSize: 12, fontWeight: '500', color: theme.colors.onInk },
  // Sheets
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  sheetNote: { fontSize: 12, color: theme.colors.textSecondary },
  sheetInput: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sheetInputShort: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sheetCta: {
    backgroundColor: theme.colors.ink,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  sheetCtaText: { fontSize: 15, fontFamily: fonts.displayBold, color: theme.colors.onInk },
  preview: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    gap: 4,
  },
  previewLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  previewText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  switchLabel: { fontSize: 14, color: theme.colors.textPrimary },
}));
