import { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { RISK_LABELS } from '@/constants/conversation';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import { pickImage, uploadImage, type PickedImage } from '@/lib/upload';

type Props = {
  conversationId: string;
  currentUserId: string;
  isProfessional?: boolean;
  scope?: 'chat' | 'internal';
  canSend?: boolean;
  forceInternal?: boolean;
  closed?: boolean;
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
}: Props) {
  const messages =
    useQuery(api.messages.list, { conversationId: conversationId as any }) ??
    [];
  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { progress } = useReanimatedKeyboardAnimation();

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
      if (picked) setPendingImage(picked);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível abrir a galeria.');
    }
  }

  async function handleSend() {
    const value = text.trim();
    if ((!value && !pendingImage) || sending) return;
    setError('');
    setSending(true);
    try {
      let imageId: string | undefined;
      if (pendingImage) {
        setUploading(true);
        const url = await generateUploadUrl();
        imageId = await uploadImage(url, pendingImage);
        setUploading(false);
      }
      await sendMessage({
        conversationId: conversationId as any,
        content: value || (pendingImage ? 'Imagem partilhada' : ''),
        messageType: pendingImage ? 'image' : 'text',
        imageId: imageId as any,
        isInternal: isInternalScope ? true : undefined,
      });
      setText('');
      setPendingImage(null);
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
          const isOwn = item.senderId === currentUserId;
          const isInternalMsg = item.isInternal;
          const hasImage = item.messageType === 'image' && item.imageUrl;
          return (
            <View
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
                {item.content && item.content !== 'Imagem partilhada' && (
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
              <Pressable
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
                  name={{ sf: 'paperclip', ion: 'attach' }}
                  size={20}
                  color={colors.text.secondary}
                />
              </Pressable>
            )}

            <TextInput
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
              onPress={handleSend}
              disabled={(!text.trim() && !pendingImage) || sending}
              style={{
                backgroundColor:
                  (text.trim() || pendingImage) && !sending
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
