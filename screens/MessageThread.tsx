import { useState, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useQuery, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { BoldText } from '@/components/ui/BoldText';
import { ChatMessage } from '@/components/chat/ChatMessage';
import {
  pickImage,
  pickDocument,
  uploadFile,
  type PickedImage,
  type PickedFile,
} from '@/lib/upload';
import { errorText } from '@/lib/errorText';
import { SafetyRuleMessage } from '@/screens/SafetyRuleMessage';

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  conversationId: string;
  currentUserId: string;
  isProfessional?: boolean;
  scope?: 'chat' | 'internal';
  canSend?: boolean;
  forceInternal?: boolean;
  closed?: boolean;
  /** Patient only: the AI suggested ending — offer a button that calls this. */
  onRequestEnd?: () => void;
  /** Conversation with the AI assistant (not a professional): adjusts the copy. */
  aiOnly?: boolean;
  /** Shown above the messages (e.g. the patient's AI chat for professionals). */
  header?: React.ReactElement | null;
  /** Shown right above the text field (e.g. the professional's quick actions). */
  aboveComposer?: React.ReactElement | null;
};


export function MessageThread({
  conversationId,
  currentUserId,
  isProfessional,
  scope = 'chat',
  canSend = true,
  forceInternal = false,
  closed = false,
  onRequestEnd,
  aiOnly = false,
  header,
  aboveComposer,
}: Props) {
  const messages =
    useQuery(api.messages.list, { conversationId: conversationId as any }) ??
    [];
  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<PickedImage | null>(null);
  const [pendingDocument, setPendingDocument] = useState<PickedFile | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Web: a textarea doesn't auto-grow and defaults to two rows. Size it to its
  // content (one line when empty) up to INPUT_MAX_HEIGHT, then it scrolls.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!el?.style) return;
    el.style.resize = 'none';
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT), INPUT_MAX_HEIGHT);
    el.style.height = `${next}px`;
  }, [text]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { progress } = useReanimatedKeyboardAnimation();
  const { theme } = useUnistyles();

  const isInternalScope = forceInternal || scope === 'internal';
  styles.useVariants({ scope: isInternalScope ? 'internal' : 'chat' });

  const filteredMessages = messages.filter((m) => {
    if (!isProfessional) return !m.isInternal;
    if (scope === 'internal') return m.isInternal;
    return !m.isInternal;
  });

  // Right after triage the thread holds only the triage card; tell the patient
  // what to do next instead of leaving a bare composer.
  // Not in AI chats: the banner above already explains how the assistant works.
  const awaitingFirstQuestion =
    !isProfessional &&
    !aiOnly &&
    canSend &&
    !closed &&
    filteredMessages.length > 0 &&
    !filteredMessages.some((m) => m.senderId === currentUserId && m.messageType === 'text');

  const animatedFooterPadding = useAnimatedStyle(() => ({
    paddingBottom: theme.spacing.md + insets.bottom * (1 - progress.value),
  }));

  async function handlePickImage() {
    setError('');
    try {
      const picked = await pickImage();
      if (picked) {
        setPendingImage(picked);
        setPendingDocument(null);
      }
    } catch (e: any) {
      setError(errorText(e, 'Não foi possível abrir a galeria.'));
    }
  }

  async function handlePickDocument() {
    setError('');
    try {
      const picked = await pickDocument();
      if (picked) {
        setPendingDocument(picked);
        setPendingImage(null);
      }
    } catch (e: any) {
      setError(errorText(e, 'Não foi possível abrir o seletor de ficheiros.'));
    }
  }

  async function handleSend() {
    const value = text.trim();
    if ((!value && !pendingImage && !pendingDocument) || sending) return;
    setError('');
    setSending(true);
    try {
      let imageId: string | undefined;
      let attachmentId: string | undefined;
      if (pendingImage) {
        setUploading(true);
        const url = await generateUploadUrl();
        imageId = await uploadFile(url, pendingImage);
        setUploading(false);
      } else if (pendingDocument) {
        setUploading(true);
        const url = await generateUploadUrl();
        attachmentId = await uploadFile(url, pendingDocument);
        setUploading(false);
      }
      const messageType = pendingImage
        ? 'image'
        : pendingDocument
          ? 'file'
          : 'text';
      const fallbackContent = pendingImage
        ? 'Imagem partilhada'
        : pendingDocument
          ? pendingDocument.fileName ?? 'Documento partilhado'
          : '';
      await sendMessage({
        conversationId: conversationId as any,
        content: value || fallbackContent,
        messageType,
        imageId: imageId as any,
        attachmentId: attachmentId as any,
        attachmentName: pendingDocument?.fileName,
        attachmentMimeType: pendingDocument?.mimeType,
        attachmentSize: pendingDocument?.size,
        isInternal: isInternalScope ? true : undefined,
      });
      setText('');
      setPendingImage(null);
      setPendingDocument(null);
      listRef.current?.scrollToEnd();
    } catch (e: any) {
      setError(errorText(e, 'Não foi possível enviar a mensagem. Tenta de novo.'));
    } finally {
      setUploading(false);
      setSending(false);
    }
  }

  const canSubmit =
    (!!text.trim() || !!pendingImage || !!pendingDocument) && !sending;

  return (
    // Plain styles on third-party wrappers: on web, Unistyles styles passed to
    // non-RN components (keyboard-controller, Reanimated) are partly dropped,
    // which collapsed this view and let the composer float mid-screen.
    <KeyboardAvoidingView
      style={layout.flex}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        testID={`messages-list-${scope}`}
        ref={listRef}
        data={filteredMessages}
        keyExtractor={(item) => item._id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        ListHeaderComponent={header ?? null}
        ListFooterComponent={
          awaitingFirstQuestion ? (
            <View testID="thread-next-step" style={styles.nextStep}>
              <Text style={styles.nextStepTitle}>Agora, conta-nos o que se passa</Text>
              <Text style={styles.nextStepText}>
                Escreve a tua dúvida em baixo. Um enfermeiro responde normalmente em 24h.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon
              name={
                scope === 'internal'
                  ? { sf: 'note.text', ion: 'document-text-outline' }
                  : {
                      sf: 'bubble.left.and.bubble.right',
                      ion: 'chatbubbles-outline',
                    }
              }
              size={32}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.emptyText}>
              {scope === 'internal'
                ? 'Sem notas internas. As notas só são visíveis a enfermeiros.'
                : isProfessional
                  ? 'Sem mensagens nesta conversa.'
                  : 'Escreve a primeira mensagem para o enfermeiro.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (
            item.messageType === 'triage-response' &&
            item.metadata?.triageData
          ) {
            return <TriageMessage data={item.metadata.triageData} aiOnly={aiOnly} />;
          }
          if (item.metadata?.safetyRule && !item.streaming) {
            return <SafetyRuleMessage ruleId={item.metadata.safetyRule} content={item.content} />;
          }
          if (item.messageType === 'system') {
            return <SystemMessage content={item.content} />;
          }
          if (item.messageType === 'ai-response') {
            // Only the latest message can carry the suggestion: once the
            // patient writes again, the conversation clearly isn't over.
            const offerEnd =
              !!onRequestEnd &&
              !closed &&
              !item.streaming &&
              !!item.metadata?.suggestClose &&
              item._id === filteredMessages[filteredMessages.length - 1]?._id;
            return (
              <>
                <AiResponseMessage content={item.content} streaming={item.streaming} />
                {offerEnd && <SuggestEndButton onPress={onRequestEnd} />}
              </>
            );
          }
          const isOwn = item.senderId === currentUserId;
          return (
            <Animated.View entering={FadeIn.duration(200)}>
              <ChatMessage
                testID={`message-${item.isInternal ? 'internal-' : ''}${item._id}`}
                side={isOwn ? 'own' : 'other'}
                internal={!!item.isInternal}
                content={item.content}
                createdAt={item._creationTime}
                imageUrl={item.imageUrl}
                attachmentUrl={item.attachmentUrl}
                attachmentName={item.attachmentName}
                attachmentSize={item.attachmentSize}
                messageType={item.messageType}
                author={(item as any).authorName}
              />
            </Animated.View>
          );
        }}
      />

      {/* A screen-supplied footer (e.g. "Atribuir a mim") replaces the notice. */}
      {!canSend && !closed && aboveComposer ? (
        <View style={[styles.composer, insets.bottom > 0 && { paddingBottom: theme.spacing.sm + insets.bottom }]}>
          {aboveComposer}
        </View>
      ) : null}

      {!canSend && !closed && !aboveComposer && (
        <View style={[styles.notice, insets.bottom > 0 && { paddingBottom: theme.spacing.sm + insets.bottom }]}>
          <Text style={styles.noticeText}>
            {isInternalScope
              ? 'Atribui esta conversa a ti para poderes escrever notas internas.'
              : 'Para responder, atribui esta conversa a ti.'}
          </Text>
        </View>
      )}

      {closed && (
        <View style={[styles.notice, insets.bottom > 0 && { paddingBottom: theme.spacing.sm + insets.bottom }]}>
          <Text style={styles.noticeText}>Conversa encerrada.</Text>
        </View>
      )}

      {canSend && !closed && (
        <Animated.View
          style={[{ backgroundColor: theme.colors.background }, animatedFooterPadding]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              tint={theme.name === 'dark' ? 'dark' : 'light'}
              intensity={24}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <View style={styles.composer}>
            {aboveComposer}

            {pendingImage && (
              <View style={styles.pendingRow}>
                <Image
                  source={{ uri: pendingImage.uri }}
                  style={styles.pendingThumb}
                  resizeMode="cover"
                />
                <View style={styles.pendingMeta}>
                  <Text style={styles.pendingName} numberOfLines={1}>
                    {pendingImage.fileName ?? 'Imagem selecionada'}
                  </Text>
                  <Text style={styles.pendingSub}>
                    {uploading ? 'A enviar...' : 'Pronta a enviar'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remover imagem"
                  onPress={() => setPendingImage(null)}
                  hitSlop={8}
                  disabled={uploading}
                >
                  <Icon
                    name={{ sf: 'xmark.circle.fill', ion: 'close-circle' }}
                    size={22}
                    color={theme.colors.textTertiary}
                  />
                </Pressable>
              </View>
            )}

            {pendingDocument && (
              <View style={styles.pendingRow}>
                <View style={styles.pendingDocIcon}>
                  <Icon
                    name={{ sf: 'doc', ion: 'document-outline' }}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </View>
                <View style={styles.pendingMeta}>
                  <Text style={styles.pendingName} numberOfLines={1}>
                    {pendingDocument.fileName ?? 'Documento selecionado'}
                  </Text>
                  <Text style={styles.pendingSub}>
                    {uploading
                      ? 'A enviar...'
                      : (formatBytes(pendingDocument.size) ?? 'Pronto a enviar')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remover documento"
                  onPress={() => setPendingDocument(null)}
                  hitSlop={8}
                  disabled={uploading}
                >
                  <Icon
                    name={{ sf: 'xmark.circle.fill', ion: 'close-circle' }}
                    size={22}
                    color={theme.colors.textTertiary}
                  />
                </Pressable>
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.inputRow}>
              {/* Attachments only with professionals: for clinical safety and data
                  protection the AI assistant doesn't analyse images or documents. */}
              {scope !== 'internal' && !aiOnly && (
                <>
                  <Pressable
                    testID="message-attach-image"
                    accessibilityRole="button"
                    onPress={handlePickImage}
                    disabled={uploading || sending}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && styles.iconBtnPressed,
                      (uploading || sending) && styles.dim,
                    ]}
                    accessibilityLabel="Anexar imagem"
                  >
                    <Icon
                      name={{ sf: 'photo', ion: 'image-outline' }}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    testID="message-attach-document"
                    accessibilityRole="button"
                    onPress={handlePickDocument}
                    disabled={uploading || sending}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && styles.iconBtnPressed,
                      (uploading || sending) && styles.dim,
                    ]}
                    accessibilityLabel="Anexar documento"
                  >
                    <Icon
                      name={{ sf: 'paperclip', ion: 'attach' }}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                </>
              )}

              <TextInput
                ref={inputRef}
                // @ts-expect-error web-only: one visible row instead of the textarea default of two
                rows={1}
                testID={isInternalScope ? 'message-input-internal' : 'message-input'}
                value={text}
                onChangeText={setText}
                // No placeholder text (it was cut off on phones); the label is for screen readers.
                accessibilityLabel={isInternalScope ? 'Escrever nota interna' : 'Escrever mensagem'}
                multiline
                editable={!uploading && !sending}
                style={styles.input}
              />
              <Pressable
                testID={isInternalScope ? 'message-send-internal' : 'message-send'}
                accessibilityRole="button"
                onPress={handleSend}
                disabled={!canSubmit}
                style={[styles.sendBtn, canSubmit ? styles.sendBtnActive : styles.sendBtnIdle]}
                accessibilityLabel="Enviar mensagem"
              >
                {sending ? (
                  <ActivityIndicator color={theme.colors.onInk} size="small" />
                ) : (
                  <Icon
                    name={{ sf: 'arrow.up', ion: 'arrow-up' }}
                    size={18}
                    color={canSubmit ? theme.colors.onInk : theme.colors.textTertiary}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function TriageMessage({
  data,
  aiOnly,
}: {
  data: { topic: string; responses: Record<string, unknown>; riskLevel: string };
  aiOnly: boolean;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.triage}>
      <View style={styles.triageHeader}>
        <Icon
          name={{ sf: 'doc.text.fill', ion: 'document-text' }}
          size={14}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.triageTitle}>Triagem concluída</Text>
      </View>
      {/* In AI chats the answers also reach a professional: switching to one
          copies the triage over, and professionals can open the AI chat. */}
      <Text style={styles.triageBody}>
        {aiOnly
          ? 'Respostas guardadas para a assistente IA. O enfermeiro também tem acesso.'
          : 'Respostas guardadas para o enfermeiro.'}
      </Text>
    </View>
  );
}

function SystemMessage({ content }: { content: string }) {
  return (
    <View style={styles.system}>
      <Text style={styles.systemText}>{content}</Text>
    </View>
  );
}

// Signature appended to AI answers until it was dropped; hidden on old messages.
const OLD_AI_SIGNATURE = /\s*— Assistente (?:AI|IA)\. Esta resposta é informativa, não substitui consulta clínica\.?\s*$/;

// AI answer bubble. Also used by the anonymous chat (app/anonymous.tsx).
export function AiResponseMessage({
  content: raw,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const content = raw.replace(OLD_AI_SIGNATURE, '');
  return (
    <View style={styles.ai}>
      <View style={styles.aiHeader}>
        <Icon
          name={{ sf: 'sparkles', ion: 'sparkles-outline' }}
          size={14}
          color={styles.aiLabel.color}
        />
        <Text style={styles.aiLabel}>Assistente de IA</Text>
      </View>
      {streaming ? (
        // The answer is shown only once the safety checks have approved it.
        <View
          testID="ai-response-preparing"
          style={styles.aiPreparing}
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="small" color={styles.aiLabel.color} />
          <Text style={styles.aiCursor}>A preparar a resposta…</Text>
        </View>
      ) : (
        <BoldText style={styles.aiBody} selectable>
          {content}
        </BoldText>
      )}
    </View>
  );
}

function SuggestEndButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.suggestEnd}>
      <Text style={styles.suggestEndText}>Já tens o que precisavas?</Text>
      <Pressable
        testID="ai-suggest-end-button"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.suggestEndBtn, pressed && styles.suggestEndPressed]}
      >
        <Text style={styles.suggestEndBtnText}>Terminar conversa</Text>
      </Pressable>
    </View>
  );
}

const layout = { flex: { flex: 1 } } as const;

const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 140;

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { padding: theme.spacing.md, gap: theme.spacing.sm },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.sm },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  nextStep: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
    gap: theme.spacing.xs,
  },
  nextStepTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  nextStepText: { fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary },
  notice: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  noticeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  composer: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  pendingThumb: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSunken,
  },
  pendingDocIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingMeta: { flex: 1 },
  pendingName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  pendingSub: { fontSize: 12, color: theme.colors.textSecondary },
  error: { fontSize: 12, color: theme.colors.danger },
  inputRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  iconBtnPressed: { backgroundColor: theme.colors.surfaceSunken },
  dim: { opacity: 0.5 },
  input: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    lineHeight: 22,
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: INPUT_MIN_HEIGHT,
    variants: {
      scope: {
        chat: { backgroundColor: theme.colors.surfaceSunken },
        internal: { backgroundColor: theme.colors.warningSurface },
      },
    },
  },
  sendBtn: {
    borderRadius: theme.radius.pill,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnIdle: { backgroundColor: theme.colors.surfaceSunken },
  sendBtnActive: {
    variants: {
      scope: {
        chat: { backgroundColor: theme.colors.ink },
        internal: { backgroundColor: theme.colors.warning },
      },
    },
  },
  triage: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  triageHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  triageTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  // Same size as the banner text above it.
  triageBody: { fontSize: 12, color: theme.colors.textSecondary },
  system: { alignItems: 'center', paddingVertical: theme.spacing.xs },
  systemText: { fontSize: 12, color: theme.colors.textTertiary, textAlign: 'center' },
  ai: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderLeftWidth: 3,
    borderLeftColor: theme.topic.intimate.fill,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  aiLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.topic.intimate.on,
    letterSpacing: 0.3,
  },
  aiBody: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
  aiCursor: { fontSize: 15, color: theme.colors.textSecondary },
  aiPreparing: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  suggestEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  suggestEndText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  suggestEndBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  suggestEndPressed: { opacity: 0.7 },
  suggestEndBtnText: { fontSize: 13, fontWeight: '500', color: theme.colors.onInk },
}));
