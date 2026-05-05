import { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { RISK_LABELS } from '@/constants/conversation';
import { spacing, typography, radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';
import { relativeTime } from '@/lib/format';
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
  high: '#DC2626',
  medium: '#D97706',
  low: '#059669',
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
  const { colors } = useTheme();

  const isInternalScope = forceInternal || scope === 'internal';

  const filteredMessages = messages.filter((m) => {
    if (!isProfessional) return !m.isInternal;
    if (scope === 'internal') return m.isInternal;
    return !m.isInternal;
  });

  const animatedFooterPadding = useAnimatedStyle(() => ({
    paddingBottom: spacing.md + insets.bottom * (1 - progress.value),
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

  const accentColor = isInternalScope ? colors.warning : colors.primary;
  const inputBg = isInternalScope
    ? colors.warningLight
    : colors.background.primary;
  const inputBorder = isInternalScope ? colors.warning : colors.border;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        testID={`messages-list-${scope}`}
        ref={listRef}
        data={filteredMessages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        contentInsetAdjustmentBehavior="automatic"
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View
            style={{
              padding: spacing.xl,
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
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
              color={colors.text.tertiary}
            />
            <Text
              style={{
                ...typography.sm,
                color: colors.text.secondary,
                textAlign: 'center',
              }}
            >
              {scope === 'internal'
                ? 'Sem notas internas. As notas só são visíveis a profissionais.'
                : isProfessional
                  ? 'Sem mensagens nesta conversa.'
                  : 'Escreve a primeira mensagem para o profissional.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.messageType === 'triage-response' && item.metadata?.triageData) {
            return <TriageMessage data={item.metadata.triageData} />;
          }
          if (item.messageType === 'system') {
            return <SystemMessage content={item.content} />;
          }
          if (item.messageType === 'ai-response') {
            return <AiResponseMessage content={item.content} />;
          }
          const isOwn = item.senderId === currentUserId;
          const isInternalMsg = item.isInternal;
          const hasImage = item.messageType === 'image' && item.imageUrl;
          const hasFile = item.messageType === 'file' && item.attachmentUrl;
          const fileLabel = item.attachmentName ?? item.content;
          const fileMeta = formatBytes(item.attachmentSize ?? undefined);
          const isContentJustFallback =
            item.content === 'Imagem partilhada' ||
            (item.messageType === 'file' &&
              item.content === item.attachmentName);
          return (
            <View
              testID={`message-${isInternalMsg ? 'internal-' : ''}${item._id}`}
              style={{
                alignSelf: isOwn ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}
            >
              {isInternalMsg && (
                <Text
                  style={{
                    ...typography.xs,
                    color: colors.warning,
                    marginBottom: 2,
                    fontWeight: '600',
                  }}
                >
                  Nota interna
                </Text>
              )}
              <View
                style={{
                  backgroundColor: isOwn
                    ? colors.primary
                    : isInternalMsg
                      ? colors.warningLight
                      : colors.background.tertiary,
                  borderRadius: radius.lg,
                  padding: hasImage ? spacing.xs : spacing.md,
                  borderWidth: isInternalMsg ? 1 : 0,
                  borderColor: isInternalMsg ? colors.warning : undefined,
                  gap: spacing.xs,
                }}
              >
                {hasImage && (
                  <Image
                    source={{ uri: item.imageUrl as string }}
                    style={{
                      width: 220,
                      aspectRatio: 1,
                      borderRadius: radius.md,
                      backgroundColor: colors.background.tertiary,
                    }}
                    resizeMode="cover"
                  />
                )}
                {hasFile && (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(item.attachmentUrl as string)
                    }
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.xs,
                      opacity: pressed ? 0.7 : 1,
                    })}
                    accessibilityLabel={`Abrir ${fileLabel}`}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.sm,
                        backgroundColor: isOwn
                          ? 'rgba(255,255,255,0.2)'
                          : colors.background.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={{ sf: 'doc', ion: 'document-outline' }}
                        size={18}
                        color={isOwn ? '#fff' : colors.text.secondary}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <Text
                        style={{
                          ...typography.sm,
                          fontWeight: '600',
                          color: isOwn ? '#fff' : colors.text.primary,
                        }}
                        numberOfLines={2}
                      >
                        {fileLabel}
                      </Text>
                      {fileMeta && (
                        <Text
                          style={{
                            ...typography.xs,
                            color: isOwn
                              ? 'rgba(255,255,255,0.85)'
                              : colors.text.secondary,
                          }}
                        >
                          {fileMeta}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                )}
                {item.content && !isContentJustFallback && (
                  <Text
                    style={{
                      ...typography.base,
                      color: isOwn ? '#fff' : colors.text.primary,
                      paddingHorizontal: hasImage ? spacing.sm : 0,
                      paddingBottom: hasImage ? spacing.xs : 0,
                    }}
                    selectable
                  >
                    {item.content}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  ...typography.xs,
                  color: colors.text.tertiary,
                  marginTop: 2,
                  textAlign: isOwn ? 'right' : 'left',
                }}
              >
                {relativeTime(item._creationTime)}
              </Text>
              {!isProfessional &&
                !closed &&
                !hideInlineAi &&
                isOwn &&
                item.messageType === 'text' && (
                  <AskAiInline
                    conversationId={conversationId}
                    query={item.content}
                  />
                )}
            </View>
          );
        }}
      />

      {!canSend && !closed && (
        <View
          style={{
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background.secondary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text
            style={{
              ...typography.sm,
              color: colors.text.secondary,
              textAlign: 'center',
            }}
          >
            Para responder, atribui esta conversa a ti.
          </Text>
        </View>
      )}

      {closed && (
        <View
          style={{
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background.secondary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text
            style={{
              ...typography.sm,
              color: colors.text.secondary,
              textAlign: 'center',
            }}
          >
            Conversa encerrada.
          </Text>
        </View>
      )}

      {!isProfessional && !closed && (
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background.secondary,
          }}
        >
          <Text
            style={{
              ...typography.xs,
              color: colors.text.tertiary,
              textAlign: 'center',
            }}
          >
            As respostas podem demorar algumas horas. Em emergência liga 112.
          </Text>
        </View>
      )}

      {canSend && !closed && (
        <Animated.View
          style={[
            {
              paddingTop: spacing.md,
              paddingHorizontal: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: spacing.sm,
              backgroundColor: colors.background.primary,
            },
            animatedFooterPadding,
          ]}
        >
          {pendingImage && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.primaryLight,
              }}
            >
              <Image
                source={{ uri: pendingImage.uri }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.sm,
                  backgroundColor: colors.background.tertiary,
                }}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.sm,
                    fontWeight: '600',
                    color: colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {pendingImage.fileName ?? 'Imagem selecionada'}
                </Text>
                <Text
                  style={{ ...typography.xs, color: colors.text.secondary }}
                >
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
                  color={colors.text.tertiary}
                />
              </Pressable>
            </View>
          )}

          {pendingDocument && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.primaryLight,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.sm,
                  backgroundColor: colors.background.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name={{ sf: 'doc', ion: 'document-outline' }}
                  size={20}
                  color={colors.text.secondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.sm,
                    fontWeight: '600',
                    color: colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {pendingDocument.fileName ?? 'Documento selecionado'}
                </Text>
                <Text
                  style={{ ...typography.xs, color: colors.text.secondary }}
                >
                  {uploading
                    ? 'A enviar...'
                    : (formatBytes(pendingDocument.size) ??
                      'Pronto a enviar')}
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
                  color={colors.text.tertiary}
                />
              </Pressable>
            </View>
          )}

          {error ? (
            <Text style={{ ...typography.xs, color: colors.danger }}>
              {error}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              alignItems: 'flex-end',
            }}
          >
            {scope !== 'internal' && (
              <>
                <Pressable
                  testID="message-attach-image"
                  onPress={handlePickImage}
                  disabled={uploading || sending}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed
                      ? colors.background.tertiary
                      : colors.background.primary,
                    opacity: uploading || sending ? 0.5 : 1,
                  })}
                  accessibilityLabel="Anexar imagem"
                >
                  <Icon
                    name={{ sf: 'photo', ion: 'image-outline' }}
                    size={20}
                    color={colors.text.secondary}
                  />
                </Pressable>
                <Pressable
                  testID="message-attach-document"
                  onPress={handlePickDocument}
                  disabled={uploading || sending}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed
                      ? colors.background.tertiary
                      : colors.background.primary,
                    opacity: uploading || sending ? 0.5 : 1,
                  })}
                  accessibilityLabel="Anexar documento"
                >
                  <Icon
                    name={{ sf: 'paperclip', ion: 'attach' }}
                    size={20}
                    color={colors.text.secondary}
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
              placeholderTextColor={colors.text.tertiary as any}
              multiline
              editable={!uploading && !sending}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                ...typography.base,
                color: colors.text.primary,
                maxHeight: 120,
                minHeight: 44,
                backgroundColor: inputBg,
              }}
            />
            <Pressable
              testID={isInternalScope ? 'message-send-internal' : 'message-send'}
              onPress={handleSend}
              disabled={
                (!text.trim() && !pendingImage && !pendingDocument) || sending
              }
              style={{
                backgroundColor:
                  (text.trim() || pendingImage || pendingDocument) && !sending
                    ? accentColor
                    : colors.border,
                borderRadius: radius.full,
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Enviar mensagem"
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon
                  name={{ sf: 'arrow.up', ion: 'arrow-up' }}
                  size={18}
                  color="#fff"
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
  const { colors } = useTheme();
  const color = RISK_COLORS[data.riskLevel] ?? colors.text.secondary;
  return (
    <View
      style={{
        backgroundColor: colors.background.tertiary,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Icon
          name={{ sf: 'doc.text.fill', ion: 'document-text' }}
          size={14}
          color={colors.text.secondary}
        />
        <Text
          style={{
            ...typography.xs,
            fontWeight: '700',
            color: colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            flex: 1,
          }}
        >
          Triagem concluída
        </Text>
        <Text
          style={{
            ...typography.xs,
            fontWeight: '700',
            color,
          }}
        >
          Risco {RISK_LABELS[data.riskLevel] ?? data.riskLevel}
        </Text>
      </View>
      <Text style={{ ...typography.sm, color: colors.text.secondary }}>
        Respostas guardadas para o profissional de saúde.
      </Text>
    </View>
  );
}

function SystemMessage({ content }: { content: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xs }}>
      <Text
        style={{
          ...typography.xs,
          color: colors.text.tertiary,
          textAlign: 'center',
        }}
      >
        {content}
      </Text>
    </View>
  );
}

function AiResponseMessage({ content }: { content: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'stretch',
        backgroundColor: colors.primaryLight,
        borderRadius: radius.lg,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text style={{ fontSize: 14 }}>✨</Text>
        <Text
          style={{
            ...typography.xs,
            fontWeight: '700',
            color: colors.primary,
            letterSpacing: 0.5,
          }}
        >
          ASSISTENTE AI
        </Text>
      </View>
      <Text
        style={{
          ...typography.sm,
          color: colors.text.primary,
          lineHeight: 22,
        }}
        selectable
      >
        {content}
      </Text>
    </View>
  );
}

function AskAiInline({ conversationId, query }: { conversationId: string; query: string }) {
  const { colors } = useTheme();
  const respond = useAction(api.ai.assistant.respond);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <View style={{ alignItems: 'flex-end', marginTop: 4, gap: 2 }}>
      <Pressable
        testID="ask-ai-inline"
        disabled={busy}
        onPress={ask}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingVertical: 4,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: busy ? colors.border : colors.primaryLight,
          borderWidth: 1,
          borderColor: colors.primary,
        }}
      >
        {busy && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={{ fontSize: 12 }}>✨</Text>
        <Text style={{ ...typography.xs, color: colors.primary, fontWeight: '600' }}>
          {busy ? 'A pensar...' : 'Resposta AI'}
        </Text>
      </Pressable>
      {error && (
        <Text style={{ ...typography.xs, color: colors.danger }}>{error}</Text>
      )}
    </View>
  );
}
