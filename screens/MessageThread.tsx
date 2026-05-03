import { useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, Pressable } from 'react-native';
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

type Props = {
  conversationId: string;
  currentUserId: string;
  isProfessional?: boolean;
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
}: Props) {
  const messages =
    useQuery(api.messages.list, { conversationId: conversationId as any }) ??
    [];
  const sendMessage = useMutation(api.messages.send);
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { progress } = useReanimatedKeyboardAnimation();

  const animatedFooterPadding = useAnimatedStyle(() => ({
    paddingBottom: spacing.md + insets.bottom * (1 - progress.value),
  }));

  async function handleSend() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendMessage({
        conversationId: conversationId as any,
        content: value,
        messageType: 'text',
        isInternal: isProfessional && isInternal ? true : undefined,
      });
      setText('');
      listRef.current?.scrollToEnd();
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={messages}
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
              name={{
                sf: 'bubble.left.and.bubble.right',
                ion: 'chatbubbles-outline',
              }}
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
              {isProfessional
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
                  padding: spacing.md,
                  borderWidth: isInternalMsg ? 1 : 0,
                  borderColor: isInternalMsg ? colors.warning : undefined,
                }}
              >
                <Text
                  style={{
                    ...typography.base,
                    color: isOwn ? '#fff' : colors.text.primary,
                  }}
                  selectable
                >
                  {item.content}
                </Text>
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
        {isProfessional && (
          <Pressable
            onPress={() => setIsInternal((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
            }}
            hitSlop={4}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: isInternal ? colors.warning : colors.border,
                backgroundColor: isInternal ? colors.warning : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isInternal && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
            </View>
            <Text
              style={{
                ...typography.sm,
                color: isInternal ? colors.warning : colors.text.secondary,
                fontWeight: isInternal ? '600' : '400',
              }}
            >
              Nota interna (não visível pela utente)
            </Text>
          </Pressable>
        )}

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'flex-end',
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              isInternal
                ? 'Escreve uma nota interna...'
                : 'Escreve uma mensagem...'
            }
            placeholderTextColor={colors.text.tertiary as any}
            multiline
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: isInternal ? colors.warning : colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              ...typography.base,
              color: colors.text.primary,
              maxHeight: 120,
              minHeight: 44,
              backgroundColor: isInternal
                ? colors.warningLight
                : colors.background.primary,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={{
              backgroundColor:
                text.trim() && !sending ? colors.primary : colors.border,
              borderRadius: radius.full,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={{ sf: 'arrow.up', ion: 'arrow-up' }}
              size={18}
              color="#fff"
            />
          </Pressable>
        </View>
      </Animated.View>
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
