import { useState, useRef } from 'react';
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
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useMutation, useAction } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { RISK_LABELS } from '@/constants/conversation';
import {
  pickImage,
  pickDocument,
  uploadFile,
  type PickedImage,
  type PickedFile,
} from '@/lib/upload';

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
  hideInlineAi?: boolean;
};

const RISK_COLORS: Record<string, string> = {
  high: '#D7264C',
  medium: '#C77B16',
  low: '#1E6B56',
};

export function MessageThread({
  conversationId,
  currentUserId,
  isProfessional,
  scope = 'chat',
  canSend = true,
  forceInternal = false,
  closed = false,
  hideInlineAi = false,
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
      setError(e?.message ?? 'Não foi possível abrir a galeria.');
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
      setError(e?.message ?? 'Não foi possível abrir o seletor de ficheiros.');
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
      setError(e?.message ?? 'Erro a enviar mensagem.');
    } finally {
      setUploading(false);
      setSending(false);
    }
  }

  const canSubmit =
    (!!text.trim() || !!pendingImage || !!pendingDocument) && !sending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
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
                ? 'Sem notas internas. As notas só são visíveis a profissionais.'
                : isProfessional
                  ? 'Sem mensagens nesta conversa.'
                  : 'Escreve a primeira mensagem para o profissional.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (
            item.messageType === 'triage-response' &&
            item.metadata?.triageData
          ) {
            return <TriageMessage data={item.metadata.triageData} />;
          }
          if (item.messageType === 'system') {
            return <SystemMessage content={item.content} />;
          }
          if (item.messageType === 'ai-response') {
            return <AiResponseMessage content={item.content} />;
          }
          const isOwn = item.senderId === currentUserId;
          const showAskAi =
            !isProfessional &&
            !closed &&
            !hideInlineAi &&
            isOwn &&
            item.messageType === 'text';
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
                footer={
                  showAskAi ? (
                    <AskAiInline
                      conversationId={conversationId}
                      query={item.content}
                    />
                  ) : undefined
                }
              />
            </Animated.View>
          );
        }}
      />

      {!canSend && !closed && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Para responder, atribui esta conversa a ti.
          </Text>
        </View>
      )}

      {closed && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Conversa encerrada.</Text>
        </View>
      )}

      {canSend && !closed && (
        <Animated.View style={[styles.composer, animatedFooterPadding]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              tint={theme.name === 'dark' ? 'dark' : 'light'}
              intensity={24}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}

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
            {scope !== 'internal' && (
              <>
                <Pressable
                  testID="message-attach-image"
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
              testID={isInternalScope ? 'message-input-internal' : 'message-input'}
              value={text}
              onChangeText={setText}
              placeholder={
                isInternalScope
                  ? 'Escreve uma nota interna...'
                  : 'Escreve uma mensagem...'
              }
              placeholderTextColor={theme.colors.textTertiary as any}
              multiline
              editable={!uploading && !sending}
              style={styles.input}
            />
            <Pressable
              testID={isInternalScope ? 'message-send-internal' : 'message-send'}
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
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function TriageMessage({
  data,
}: {
  data: { topic: string; responses: Record<string, unknown>; riskLevel: string };
}) {
  const { theme } = useUnistyles();
  const color = RISK_COLORS[data.riskLevel] ?? theme.colors.textSecondary;
  return (
    <View style={styles.triage}>
      <View style={styles.triageHeader}>
        <Icon
          name={{ sf: 'doc.text.fill', ion: 'document-text' }}
          size={14}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.triageTitle}>Triagem concluída</Text>
        <Text style={[styles.triageRisk, { color }]}>
          Risco {RISK_LABELS[data.riskLevel] ?? data.riskLevel}
        </Text>
      </View>
      <Text style={styles.triageBody}>
        Respostas guardadas para o profissional de saúde.
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

function AiResponseMessage({ content }: { content: string }) {
  return (
    <View style={styles.ai}>
      <View style={styles.aiHeader}>
        <Text style={styles.aiSparkle}>✨</Text>
        <Text style={styles.aiLabel}>Assistente Wysta</Text>
      </View>
      <Text style={styles.aiBody} selectable>
        {content}
      </Text>
    </View>
  );
}

function AskAiInline({
  conversationId,
  query,
}: {
  conversationId: string;
  query: string;
}) {
  const respond = useAction(api.ai.assistant.respond);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useUnistyles();

  async function ask() {
    setError(null);
    setBusy(true);
    try {
      await respond({ conversationId: conversationId as any, query });
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.askWrap}>
      <Pressable
        testID="ask-ai-inline"
        disabled={busy}
        onPress={ask}
        style={[styles.askPill, busy && styles.askPillBusy]}
      >
        {busy && <ActivityIndicator size="small" color={theme.colors.accent} />}
        <Text style={styles.askSparkle}>✨</Text>
        <Text style={styles.askLabel}>{busy ? 'A pensar...' : 'Resposta AI'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  list: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { padding: theme.spacing.md, gap: theme.spacing.sm },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.sm },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
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
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
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
    maxHeight: 120,
    minHeight: 44,
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
  triageRisk: { fontSize: 12, fontWeight: '500' },
  triageBody: { fontSize: 14, color: theme.colors.textSecondary },
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
  aiSparkle: { fontSize: 14 },
  aiLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.topic.intimate.on,
    letterSpacing: 0.3,
  },
  aiBody: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
  askWrap: { alignItems: 'flex-end', marginTop: 4, gap: 2 },
  askPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.topic.contraception.fill,
  },
  askPillBusy: { opacity: 0.7 },
  askSparkle: { fontSize: 12 },
  askLabel: { fontSize: 12, fontWeight: '500', color: theme.topic.contraception.on },
}));
