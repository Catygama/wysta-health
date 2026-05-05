import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
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

  const isAiOnly = conversation?.kind === 'ai-only';

  return (
    <>
      <Stack.Screen options={{ title: topic?.label ?? 'Conversa' }} />
      {isAiOnly && !closed && (
        <AiOnlyBanner conversationId={id} />
      )}
      <MessageThread
        conversationId={id}
        currentUserId={user._id}
        isProfessional={false}
        closed={closed}
        hideInlineAi={isAiOnly}
      />
    </>
  );
}

function AiOnlyBanner({ conversationId }: { conversationId: string }) {
  const { colors } = useTheme();
  const handoff = useMutation(api.conversations.requestAiHandoff);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setError(null);
    setBusy(true);
    try {
      await handoff({ id: conversationId as any });
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        marginHorizontal: spacing.sm,
        marginTop: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.primaryLight,
        borderWidth: 1,
        borderColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <Text style={{ fontSize: 14 }}>💬</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.xs, fontWeight: '700', color: colors.primary }}>
          Conversa só com AI
        </Text>
        <Text style={{ ...typography.xs, color: colors.text.secondary }}>
          Cada mensagem tua recebe resposta automática. Para profissional, toca à direita.
        </Text>
      </View>
      <Pressable
        testID="ai-handoff-button"
        disabled={busy}
        onPress={ask}
        style={{
          paddingHorizontal: spacing.sm,
          paddingVertical: 6,
          borderRadius: radius.full,
          backgroundColor: busy ? colors.border : colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {busy && <ActivityIndicator size="small" color="#fff" />}
        <Text style={{ ...typography.xs, fontWeight: '600', color: '#fff' }}>
          {busy ? 'A pedir...' : 'Falar com profissional'}
        </Text>
      </Pressable>
      {error && (
        <Text style={{ ...typography.xs, color: colors.danger }}>{error}</Text>
      )}
    </View>
  );
}
