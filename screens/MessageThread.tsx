import { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { colors, spacing, typography, radius } from '@/constants/theme';

type Props = {
  conversationId: string;
  currentUserId: string;
  isProfessional?: boolean;
};

export function MessageThread({ conversationId, currentUserId, isProfessional }: Props) {
  const messages = useQuery(api.messages.list, { conversationId: conversationId as any }) ?? [];
  const sendMessage = useMutation(api.messages.send);
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function handleSend() {
    if (!text.trim()) return;
    await sendMessage({
      conversationId: conversationId as any,
      content: text.trim(),
      messageType: 'text',
      isInternal: isProfessional && isInternal ? true : undefined,
    });
    setText('');
    listRef.current?.scrollToEnd();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        contentInsetAdjustmentBehavior="automatic"
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => {
          const isOwn = item.senderId === currentUserId;
          const isInternalMsg = item.isInternal;
          return (
            <View style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {isInternalMsg && (
                <Text style={{ ...typography.xs, color: colors.warning, marginBottom: 2 }}>
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
                  style={{ ...typography.base, color: isOwn ? '#fff' : colors.text.primary }}
                  selectable
                >
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View
        style={{
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: spacing.sm,
          backgroundColor: colors.background.primary,
        }}
      >
        {isProfessional && (
          <Pressable
            onPress={() => setIsInternal((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
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
            <Text style={{ ...typography.sm, color: colors.text.secondary }}>
              Nota interna (não visível pela utente)
            </Text>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escreve uma mensagem..."
            multiline
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: isInternal ? colors.warning : colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              ...typography.base,
              color: colors.text.primary,
              maxHeight: 120,
              backgroundColor: isInternal ? colors.warningLight : colors.background.primary,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim()}
            style={{
              backgroundColor: text.trim() ? colors.primary : colors.border,
              borderRadius: radius.full,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
