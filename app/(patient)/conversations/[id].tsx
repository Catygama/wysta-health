import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { MessageThread } from '@/screens/MessageThread';
import { useTabBar } from '@/contexts/TabBarContext';
import { TOPICS } from '@/constants/topics';

export default function PatientConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(api.conversations.get, id ? { id: id as any } : 'skip');
  const messages = useQuery(api.messages.list, id ? { conversationId: id as any } : 'skip') ?? [];
  const { setIsTabBarHidden } = useTabBar();
  const respond = useAction(api.ai.assistant.respond);

  const [menuOpen, setMenuOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

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

  // The assistant answers the patient's most recent text message. AI-only
  // conversations already auto-respond to every message, so the manual
  // trigger is offered only on professional conversations.
  const lastPatientQuery = [...messages]
    .reverse()
    .find((m) => m.senderId === user._id && m.messageType === 'text')?.content;
  const canAskAi = !isAiOnly && !closed && !!lastPatientQuery;

  async function askAssistant() {
    if (!lastPatientQuery) return;
    setMenuOpen(false);
    setAskError(null);
    setAsking(true);
    try {
      await respond({ conversationId: id as any, query: lastPatientQuery });
    } catch (e: any) {
      setAskError(e?.message ?? 'Não foi possível obter resposta da assistente.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: topic?.label ?? 'Conversa',
          headerRight:
            canAskAi && !asking
              ? () => <KebabButton onPress={() => setMenuOpen((o) => !o)} />
              : undefined,
        }}
      />
      {isAiOnly && !closed && <AiOnlyBanner conversationId={id} />}
      {asking && <AskingBanner />}
      {askError && <AskErrorBanner text={askError} onDismiss={() => setAskError(null)} />}
      <MessageThread
        conversationId={id}
        currentUserId={user._id}
        isProfessional={false}
        closed={closed}
      />
      {menuOpen && canAskAi && (
        <ConversationMenu onAsk={askAssistant} onClose={() => setMenuOpen(false)} />
      )}
    </>
  );
}

function KebabButton({ onPress }: { onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      testID="conversation-menu-button"
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Mais opções"
      style={({ pressed }) => [styles.kebab, pressed && styles.kebabPressed]}
    >
      <Icon
        name={{ sf: 'ellipsis', ion: 'ellipsis-vertical' }}
        size={20}
        color={theme.colors.ink}
      />
    </Pressable>
  );
}

function ConversationMenu({
  onAsk,
  onClose,
}: {
  onAsk: () => void;
  onClose: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.menu}>
        <Pressable
          testID="conversation-ask-ai"
          onPress={onAsk}
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
        >
          <Icon
            name={{ sf: 'sparkles', ion: 'sparkles' }}
            size={18}
            color={theme.topic.contraception.on}
          />
          <Text style={styles.menuLabel}>Pedir resposta da assistente</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AskingBanner() {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.banner, styles.askingBanner]}>
      <ActivityIndicator size="small" color={theme.topic.contraception.on} />
      <Text style={styles.askingText}>A assistente está a pensar…</Text>
    </View>
  );
}

function AskErrorBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable style={[styles.banner, styles.errorBanner]} onPress={onDismiss}>
      <Icon
        name={{ sf: 'exclamationmark.triangle', ion: 'warning-outline' }}
        size={16}
        color={theme.colors.danger}
      />
      <Text style={styles.errorText}>{text}</Text>
    </Pressable>
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
  kebab: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kebabPressed: { backgroundColor: theme.colors.surfaceSunken },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  menu: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.sm,
    minWidth: 240,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  menuItemPressed: { backgroundColor: theme.colors.surfaceSunken },
  menuLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.ink },
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
  askingBanner: { backgroundColor: theme.topic.contraception.fill },
  askingText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.topic.contraception.on,
  },
  errorBanner: { backgroundColor: theme.colors.dangerLight },
  errorText: { flex: 1, fontSize: 13, color: theme.colors.danger },
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
