import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { useTabBar } from '@/contexts/TabBarContext';
import { TOPICS } from '@/constants/topics';

export default function PatientConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(api.conversations.get, id ? { id: id as any } : 'skip');
  const { setIsTabBarHidden } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden])
  );

  if (!user || !id) return null;
  const topic = conversation ? TOPICS.find((t) => t.id === conversation.topic) : undefined;
  const closed = conversation?.status === 'closed';
  const isAiOnly = conversation?.kind === 'ai-only';

  return (
    <>
      <Stack.Screen options={{ title: topic?.label ?? 'Conversa' }} />
      {isAiOnly && !closed && <AiOnlyBanner conversationId={id} />}
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
  const { theme } = useUnistyles();
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
    <View style={styles.banner}>
      <View style={styles.avatar}>
        <Text style={styles.emoji}>💬</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Conversa só com AI</Text>
        <Text style={styles.sub}>
          Cada mensagem tua recebe resposta automática. Para profissional, toca à
          direita.
        </Text>
      </View>
      <Pressable
        testID="ai-handoff-button"
        disabled={busy}
        onPress={ask}
        style={[styles.cta, busy && styles.ctaBusy]}
      >
        {busy && <ActivityIndicator size="small" color={theme.colors.onInk} />}
        <Text style={styles.ctaText}>{busy ? 'A pedir...' : 'Falar com profissional'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  banner: {
    marginHorizontal: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.topic.intimate.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 16 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '500', color: theme.colors.ink },
  sub: { fontSize: 12, color: theme.colors.textSecondary },
  cta: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { fontSize: 12, fontWeight: '500', color: theme.colors.onInk },
  error: { fontSize: 12, color: theme.colors.danger },
}));
