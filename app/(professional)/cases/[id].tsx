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
  useWindowDimensions,
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
  PRIORITY_LABELS,
  priorityColors,
} from '@/constants/conversation';
import { useTabBar } from '@/contexts/TabBarContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { AlertLevel } from '@/convex/lib/alerts';

// What the options panel shows: the menu, or one of the views it opens.
type PanelView = 'menu' | 'internal' | 'summary' | 'triage';

// From this width the options panel stays open beside the chat.
const WIDE_LAYOUT = 900;

// Case screen for professionals: the chat fills the screen (like the
// patient's). The AI clinical profile and "Recomendar presencial" sit right
// above the text field; everything else lives in an options panel, a drawer
// on phones and a fixed column on wide screens.
export default function ProfessionalConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(api.conversations.get, id ? { id: id as any } : 'skip');
  const messages = useQuery(api.messages.list, id ? { conversationId: id as any } : 'skip');
  const assign = useMutation(api.conversations.assign);
  const close = useMutation(api.conversations.close);
  const recommendInPerson = useMutation(api.conversations.recommendInPerson);
  const { setIsTabBarHidden } = useTabBar();
  const [redirectOpen, setRedirectOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('menu');
  const { theme } = useUnistyles();
  const wide = useWindowDimensions().width >= WIDE_LAYOUT;

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
  const triageMessage = messages?.find((m) => m.metadata?.triageData);
  const triage = triageMessage?.metadata?.triageData;
  const isMine = conversation.professionalId === user._id;
  const isClosed = conversation.status === 'closed';
  const isAiOnly = conversation.kind === 'ai-only';
  // Chats with the AI are read-only context, never assigned.
  const canAssign = !isMine && !isClosed && !isAiOnly;
  const isAssignedToOther = !!conversation.professionalId && !isMine;
  const canClose = isMine && !isClosed;
  const canEscalate = isMine && !isClosed;
  const patientName =
    conversation.patient?.displayName ?? conversation.patient?.email ?? 'Utente convidada';
  const priorityLabel = PRIORITY_LABELS[conversation.priority] ?? conversation.priority;

  const openPanel = (view: PanelView = 'menu') => {
    setPanelView(view);
    if (!wide) setDrawerOpen(true);
  };

  const panel = (
    <OptionsPanel
      view={panelView}
      onView={setPanelView}
      onClose={wide ? undefined : () => setDrawerOpen(false)}
      conversationId={id}
      currentUserId={user._id}
      conversation={conversation}
      triage={triage}
      messageCount={messages?.length ?? 0}
      isMine={isMine}
      isClosed={isClosed}
      canAssign={canAssign}
      isAssignedToOther={isAssignedToOther}
      canEscalate={canEscalate}
      canClose={canClose}
      onAssign={() => assign({ id: id as any })}
      onRequestClose={() => setConfirmClose(true)}
      onOpenRelated={(relatedId) =>
        router.push({ pathname: '/(professional)/cases/[id]', params: { id: relatedId } })
      }
    />
  );

  // Top of the messages: the AI clinical profile (collapsed), then any linked
  // chat with the AI.
  const threadHeader = (
    <View style={styles.threadHeader}>
      {conversation.patient && (
        <ClinicalProfile
          patientId={conversation.patientId}
          aiSummary={conversation.patient.aiSummary}
          aiSummaryAt={conversation.patient.aiSummaryAt}
        />
      )}
      <AiContextBlock conversationId={id} />
    </View>
  );

  const aboveComposer = canAssign ? (
    // Not mine yet: one clear, full-width action where the text field will be.
    <View style={styles.assign}>
      <Pressable
        testID="conversation-assign-button"
        accessibilityRole="button"
        onPress={() => assign({ id: id as any })}
        style={({ pressed }) => [styles.assignBtn, pressed && styles.dim]}
      >
        <Icon
          name={{ sf: 'person.crop.circle.badge.checkmark', ion: 'person-add-outline' }}
          size={18}
          color={theme.colors.onInk}
        />
        <Text style={styles.assignText}>
          {isAssignedToOther ? 'Assumir conversa e responder' : 'Atribuir a mim e responder'}
        </Text>
      </Pressable>
      <Text style={styles.assignHint}>Ao atribuir, passas a ser o profissional deste caso.</Text>
    </View>
  ) : (
    <View style={styles.quick}>
      <View style={styles.quickRow}>
        {canEscalate && (
          <QuickChip
            testID="conversation-recommend-in-person"
            icon={{ sf: 'cross.case', ion: 'medkit-outline' }}
            label="Recomendar presencial"
            onPress={() => setRedirectOpen(true)}
          />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View>
              <Text style={styles.headerName} numberOfLines={1}>
                {patientName}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {topic?.label ?? conversation.topic} · Prioridade {priorityLabel.toLowerCase()}
              </Text>
            </View>
          ),
          headerRight: wide
            ? undefined
            : () => (
                <Pressable
                  testID="case-options-open"
                  accessibilityRole="button"
                  accessibilityLabel="Abrir opções do caso"
                  hitSlop={8}
                  onPress={() => openPanel('menu')}
                  style={({ pressed }) => [styles.headerBtn, pressed && styles.dim]}
                >
                  <Icon
                    name={{ sf: 'sidebar.right', ion: 'options-outline' }}
                    size={22}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>
              ),
        }}
      />

      <View style={styles.main}>
        <MessageThread
          conversationId={id}
          currentUserId={user._id}
          isProfessional
          scope="chat"
          canSend={isMine}
          closed={isClosed}
          header={threadHeader}
          aboveComposer={!isClosed && (canAssign || canEscalate) ? aboveComposer : null}
        />
      </View>

      {wide && <View style={styles.sideColumn}>{panel}</View>}

      {!wide && (
        <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
          <View style={styles.drawerWrap}>
            <Pressable
              style={styles.drawerShade}
              accessibilityLabel="Fechar opções"
              onPress={() => setDrawerOpen(false)}
            />
            <View style={styles.drawer}>{panel}</View>
          </View>
        </Modal>
      )}

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
          setDrawerOpen(false);
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

type Triage = {
  topic: string;
  responses: Record<string, unknown>;
  riskLevel: string;
  alertLevel?: AlertLevel;
};

type OptionsPanelProps = {
  view: PanelView;
  onView: (v: PanelView) => void;
  /** Drawer only: closes it. Absent in the fixed side column. */
  onClose?: () => void;
  conversationId: string;
  currentUserId: string;
  conversation: any;
  triage?: Triage;
  messageCount: number;
  isMine: boolean;
  isClosed: boolean;
  canAssign: boolean;
  isAssignedToOther: boolean;
  canEscalate: boolean;
  canClose: boolean;
  onAssign: () => void;
  onRequestClose: () => void;
  onOpenRelated: (id: string) => void;
};

// The case options: status and patient details, then the menu (internal
// notes, summary, triage answers, priority, close). Notes, summary and triage
// open inside the panel with a "‹ Opções" back link.
function OptionsPanel(p: OptionsPanelProps) {
  const { theme } = useUnistyles();
  const c = p.conversation;

  const header = (title: string, back: boolean) => (
    <View style={styles.panelHeader}>
      {back ? (
        <Pressable
          testID="case-panel-back"
          accessibilityRole="button"
          accessibilityLabel="Voltar às opções"
          hitSlop={8}
          onPress={() => p.onView('menu')}
          style={styles.panelBack}
        >
          <Icon name={{ sf: 'chevron.left', ion: 'chevron-back' }} size={20} color={theme.colors.textPrimary} />
          <Text style={styles.panelTitle}>{title}</Text>
        </Pressable>
      ) : (
        <Text style={styles.panelTitle}>{title}</Text>
      )}
      {p.onClose && (
        <Pressable
          testID="case-options-close"
          accessibilityRole="button"
          accessibilityLabel="Fechar opções"
          hitSlop={8}
          onPress={p.onClose}
        >
          <Icon name={{ sf: 'xmark', ion: 'close' }} size={22} color={theme.colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );

  if (p.view === 'internal') {
    return (
      <View style={styles.panel}>
        {header('Notas internas', true)}
        <View style={styles.panelFill}>
          <MessageThread
            conversationId={p.conversationId}
            currentUserId={p.currentUserId}
            isProfessional
            scope="internal"
            canSend={p.isMine}
            closed={p.isClosed}
          />
        </View>
      </View>
    );
  }

  if (p.view === 'summary') {
    return (
      <View style={styles.panel}>
        {header('Sumário', true)}
        <SummaryPanel
          conversationId={p.conversationId}
          messageCount={p.messageCount}
          aiSummary={c.aiSummary}
          aiSummaryAt={c.aiSummaryAt}
          canGenerate={p.isMine && p.messageCount > 0}
        />
      </View>
    );
  }

  if (p.view === 'triage') {
    return (
      <View style={styles.panel}>
        {header('Respostas da triagem', true)}
        <ScrollView contentContainerStyle={styles.panelBody}>
          {p.triage ? (
            <TriageSummary
              riskLevel={p.triage.riskLevel}
              alertLevel={c.alertLevel}
              responses={p.triage.responses ?? {}}
            />
          ) : (
            <Text style={styles.muted}>Esta conversa não tem questionário de triagem.</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {header('Opções', false)}
      <ScrollView contentContainerStyle={styles.panelBody}>
        {c.patient && (
          <View style={styles.patient}>
            <Text style={styles.patientLine}>
              {c.patient.displayName ?? c.patient.email ?? 'Utente convidada'}
              {c.patient.ageRange ? ` • ${c.patient.ageRange}` : ''}
              {c.patient.location ? ` • ${c.patient.location}` : ''}
            </Text>
            {(c.patient.conditions?.length ?? 0) > 0 && (
              <Text style={styles.patientMeta}>
                <Text style={styles.patientMetaStrong}>Condições: </Text>
                {c.patient.conditions.join(', ')}
              </Text>
            )}
            {(c.patient.medications?.length ?? 0) > 0 && (
              <Text style={styles.patientMeta}>
                <Text style={styles.patientMetaStrong}>Medicação: </Text>
                {c.patient.medications.join(', ')}
              </Text>
            )}
          </View>
        )}

        <View style={styles.menu}>
          {/* "Atribuir a mim" lives only in the chat footer. */}
          <MenuItem
            testID="case-menu-triage"
            icon={{ sf: 'list.bullet.clipboard', ion: 'clipboard-outline' }}
            label="Respostas da triagem"
            chevron
            onPress={() => p.onView('triage')}
          />
          <MenuItem
            testID="thread-tab-internal"
            icon={{ sf: 'note.text', ion: 'document-text-outline' }}
            label="Notas internas"
            chevron
            onPress={() => p.onView('internal')}
          />
          <MenuItem
            testID="thread-tab-summary"
            icon={{ sf: 'text.alignleft', ion: 'reader-outline' }}
            label="Sumário"
            chevron
            onPress={() => p.onView('summary')}
          />
          {c.contextConversation && c.contextConversation.kind !== 'ai-only' && (
            <MenuItem
              testID="related-context-conversation"
              icon={{ sf: 'clock.arrow.circlepath', ion: 'time-outline' }}
              label="Ver conversa anterior"
              chevron
              onPress={() => p.onOpenRelated(c.contextConversation._id)}
            />
          )}
          {p.canClose && (
            <MenuItem
              testID="conversation-close-button"
              icon={{ sf: 'xmark.circle', ion: 'close-circle-outline' }}
              label="Encerrar conversa"
              danger
              onPress={p.onRequestClose}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  chevron,
  danger,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  chevron?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const color = danger ? priorityColors(theme.name).urgent : theme.colors.textPrimary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.dim]}
    >
      <Icon name={icon} size={18} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      {chevron && <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={16} color={theme.colors.textTertiary} />}
    </Pressable>
  );
}

function QuickChip({
  icon,
  label,
  onPress,
  primary,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const color = primary ? theme.colors.onInk : theme.colors.textPrimary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, primary ? styles.chipPrimary : styles.chipOutline, pressed && styles.dim]}
    >
      <Icon name={icon} size={14} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function SummaryPanel({
  conversationId,
  messageCount,
  aiSummary,
  aiSummaryAt,
  canGenerate,
}: {
  conversationId: string;
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
    <ScrollView contentContainerStyle={styles.panelBody}>
      <Text style={styles.muted}>Mensagens nesta conversa: {messageCount}</Text>
      <View style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiTitle}>Sumário AI</Text>
          {aiSummaryAt && <Text style={styles.aiDate}>{new Date(aiSummaryAt).toLocaleString('pt-PT')}</Text>}
        </View>
        {aiSummary ? (
          <Text style={styles.aiBody}>{aiSummary}</Text>
        ) : (
          <Text style={styles.muted}>Ainda sem sumário. Gera um resumo clínico desta conversa com AI.</Text>
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
          <Text style={styles.muted}>Atribui-te a conversa e aguarda mensagens antes de gerar.</Text>
        )}
      </View>
    </ScrollView>
  );
}

// AI clinical profile of the patient, collapsed by default at the top of the
// messages; tap to read it and to (re)generate it.
function ClinicalProfile({
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
  const [open, setOpen] = useState(false);
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
    <View style={styles.profile}>
      <Pressable
        testID="clinical-profile-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.profileHead, pressed && styles.dim]}
      >
        <Icon name={{ sf: 'sparkles', ion: 'sparkles-outline' }} size={14} color={theme.topic.intimate.on} />
        <Text style={styles.profileTitle}>Perfil clínico (IA)</Text>
        {aiSummaryAt && <Text style={styles.aiDate}>{new Date(aiSummaryAt).toLocaleDateString('pt-PT')}</Text>}
        <Icon
          name={open ? { sf: 'chevron.up', ion: 'chevron-up' } : { sf: 'chevron.down', ion: 'chevron-down' }}
          size={16}
          color={theme.topic.intimate.on}
        />
      </Pressable>
      {open && (
        <View style={styles.profileBody}>
          {aiSummary ? (
            <Text style={styles.profileText}>{aiSummary}</Text>
          ) : (
            <Text style={styles.muted}>Sem perfil gerado.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            testID="generate-user-summary-button"
            disabled={busy}
            onPress={onGenerate}
            style={[styles.profileBtn, busy && styles.dim]}
          >
            {busy && <ActivityIndicator color={theme.colors.onInk} size="small" />}
            <Text style={styles.profileBtnText}>{busy ? 'A gerar...' : aiSummary ? 'Atualizar' : 'Gerar perfil AI'}</Text>
          </Pressable>
        </View>
      )}
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

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background },
  main: { flex: 1 },
  headerName: { fontFamily: fonts.displayBold, fontSize: 17, color: theme.colors.textPrimary },
  headerSub: { fontSize: 12, color: theme.colors.textSecondary },
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.xs },
  dim: { opacity: 0.7 },
  threadHeader: { gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  // Above the composer
  quick: { gap: theme.spacing.sm },
  assign: { gap: theme.spacing.xs, paddingBottom: theme.spacing.xs },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 40,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.ink,
  },
  assignText: { fontSize: 14, fontWeight: '600', color: theme.colors.onInk },
  assignHint: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
  },
  chipPrimary: { backgroundColor: theme.colors.ink },
  chipOutline: { borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipText: { fontSize: 13, fontWeight: '600' },
  // Clinical profile
  profile: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: theme.topic.intimate.fill,
    overflow: 'hidden',
  },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, padding: theme.spacing.sm },
  profileTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.topic.intimate.on },
  profileBody: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  profileText: { fontSize: 13, lineHeight: 19, color: theme.colors.textPrimary },
  profileBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  profileBtnText: { fontSize: 12, fontWeight: '500', color: theme.colors.onInk },
  // Options panel (drawer on phones, fixed column on wide screens)
  sideColumn: { width: 340, borderLeftWidth: 1, borderLeftColor: theme.colors.divider },
  drawerWrap: { flex: 1, flexDirection: 'row' },
  drawerShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: { width: '85%', maxWidth: 380, backgroundColor: theme.colors.background },
  panel: { flex: 1, backgroundColor: theme.colors.background },
  panelFill: { flex: 1 },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  panelBack: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  panelTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: theme.colors.textPrimary },
  panelBody: { padding: theme.spacing.md, gap: theme.spacing.md },
  patient: { gap: theme.spacing.xs },
  patientLine: { fontSize: 14, color: theme.colors.textSecondary },
  patientMeta: { fontSize: 12, color: theme.colors.textSecondary },
  patientMetaStrong: { fontWeight: '500' },
  menu: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  muted: { fontSize: 13, color: theme.colors.textSecondary },
  // Summary
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
  aiDate: { fontSize: 12, color: theme.colors.textTertiary },
  aiBody: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
  error: { fontSize: 13, color: theme.colors.danger },
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
