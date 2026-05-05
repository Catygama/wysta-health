import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { useTabBar } from '@/contexts/TabBarContext';
import { TOPICS } from '@/constants/topics';
import { spacing, typography, radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

export default function PatientConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as any } : 'skip'
  );
  const { setIsTabBarHidden } = useTabBar();
  const { colors } = useTheme();
  const [askOpen, setAskOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden])
  );

  if (!user || !id) return null;
  const topic = conversation
    ? TOPICS.find((t) => t.id === conversation.topic)
    : undefined;
  const closed = conversation?.status === 'closed';

  return (
    <>
      <Stack.Screen options={{ title: topic?.label ?? 'Conversa' }} />
      {!closed && (
        <Pressable
          testID="ask-ai-open-button"
          onPress={() => setAskOpen(true)}
          style={{
            margin: spacing.sm,
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
          <Text style={{ ...typography.sm, color: colors.primary, fontWeight: '600' }}>
            Pergunta rápida à AI
          </Text>
          <Text
            style={{
              ...typography.xs,
              color: colors.text.secondary,
              marginLeft: 'auto',
            }}
          >
            Informativo • não substitui consulta
          </Text>
        </Pressable>
      )}
      <MessageThread
        conversationId={id}
        currentUserId={user._id}
        isProfessional={false}
        closed={closed}
      />
      <AskAiSheet
        visible={askOpen}
        conversationId={id}
        onClose={() => setAskOpen(false)}
      />
    </>
  );
}

function AskAiSheet({
  visible,
  conversationId,
  onClose,
}: {
  visible: boolean;
  conversationId: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const respond = useAction(api.ai.assistant.respond);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (query.trim().length < 5) {
      setError('Escreve uma pergunta mais completa.');
      return;
    }
    setBusy(true);
    try {
      await respond({ conversationId: conversationId as any, query: query.trim() });
      setQuery('');
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
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
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.lg, fontWeight: '700', color: colors.text.primary }}>
              ✨ Pergunta à AI
            </Text>
            <Pressable testID="ask-ai-close" onPress={onClose}>
              <Text style={{ ...typography.lg, color: colors.text.secondary }}>×</Text>
            </Pressable>
          </View>
          <Text style={{ ...typography.xs, color: colors.text.secondary }}>
            Resposta informativa, validada por agente clínico e de segurança.
            Não substitui consulta nem prescrição. Casos urgentes →{' '}
            <Text style={{ fontWeight: '600' }}>SNS24 (808 24 24 24)</Text> ou 112.
          </Text>
          <TextInput
            testID="ask-ai-input"
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
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
          {error && (
            <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
          )}
          <Pressable
            testID="ask-ai-submit"
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
        </View>
      </View>
    </Modal>
  );
}
