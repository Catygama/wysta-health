import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useAction, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { TOPICS, TOPIC_CHOICES, OTHER_TOPIC, type Topic } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { fonts } from '@/lib/fonts';
import { relativeTime } from '@/lib/format';

export default function PatientHome() {
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const conversations = useQuery(api.conversations.listForPatient) ?? [];
  const greeting =
    user?.profile?.displayName?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'utente';

  const active = conversations.filter((c) => c.status !== 'closed');

  function startTopic(topicId: string) {
    if (topicId === 'sexual-wellbeing') {
      router.push('/wellbeing');
      return;
    }
    router.push({ pathname: '/triage', params: { topic: topicId } });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Olá, {greeting}</Text>
        <Text style={styles.subtitle}>Sobre o que precisas de ajuda hoje?</Text>
      </View>

      {active.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>As tuas conversas</Text>
          <View style={styles.feed}>
            {active.map((c) => (
              <ConversationFeedCard
                key={c._id}
                conversation={c}
                onPress={() =>
                  router.push({
                    pathname: '/(patient)/conversations/[id]',
                    params: { id: c._id },
                  })
                }
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section} testID="patient-new-conversation">
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Falar com uma profissional
          </Text>
          <Text style={styles.sectionNote}>Escolhe o tema. Respondemos normalmente em 24h.</Text>
        </View>
        <View style={styles.topicGrid}>
          {TOPIC_CHOICES.map((t) => (
            <TopicTile
              key={t.id}
              testID={`patient-topic-chip-${t.id}`}
              topic={t}
              onPress={() => startTopic(t.id)}
            />
          ))}
          <TopicTile
            testID="patient-other-question"
            topic={OTHER_TOPIC}
            label="Outro assunto"
            onPress={() => startTopic(OTHER_TOPIC.id)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Resposta imediata
          </Text>
          <Text style={styles.sectionNote}>
            Resposta gerada por Inteligência Artificial. Não substitui um profissional.
          </Text>
        </View>
        <StartAiOnlyButton />
        <AnonymousAiButton />
      </View>
    </ScrollView>
  );
}

type FeedConversation = {
  _id: string;
  topic: string;
  preview: string | null;
  previewAt: number | null;
  responderName: string | null;
  isAiOnly: boolean;
};

function ConversationFeedCard({
  conversation,
  onPress,
}: {
  conversation: FeedConversation;
  onPress: () => void;
}) {
  const topic = TOPICS.find((t) => t.id === conversation.topic);
  const isAi = conversation.isAiOnly;
  const name = conversation.responderName ?? (isAi ? 'Assistente Wysta' : 'Equipa Wysta');
  const initials = conversation.responderName
    ? conversation.responderName
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : isAi
      ? 'AI'
      : 'W';
  const tone = conversation.responderName ? 'lilac' : isAi ? 'mint' : 'ink';

  return (
    <Card
      testID={`patient-conversation-${conversation._id}`}
      onPress={onPress}
      style={styles.feedCard}
    >
      <Avatar initials={initials} tone={tone} size={44} />
      <View style={styles.feedBody}>
        <View style={styles.feedTop}>
          <Text style={styles.feedName} numberOfLines={1}>{name}</Text>
          {conversation.previewAt && (
            <Text style={styles.feedTime}>{relativeTime(conversation.previewAt)}</Text>
          )}
        </View>
        <Text style={styles.feedTopic}>{topic?.label ?? conversation.topic}</Text>
        {conversation.preview && (
          <Text style={styles.feedPreview} numberOfLines={1}>{conversation.preview}</Text>
        )}
      </View>
    </Card>
  );
}

function TopicTile({
  topic,
  label,
  onPress,
  testID,
}: {
  topic: Topic;
  label?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const pastel = theme.topic[topic.color];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label ?? topic.label}
      accessibilityHint={topic.description}
      onPress={onPress}
      style={({ pressed }) => [
        styles.topicTile,
        { backgroundColor: pastel.fill },
        pressed && styles.tilePressed,
      ]}
    >
      <Icon name={topic.icon} size={26} color={pastel.on} />
      <Text style={[styles.topicTileLabel, { color: pastel.on }]}>{label ?? topic.label}</Text>
    </Pressable>
  );
}

function AnonymousAiButton() {
  const { theme } = useUnistyles();
  const respond = useAction(api.ai.assistant.respondAnonymous);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setQuery('');
    setAnswer(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (query.trim().length < 5) {
      setError('Escreve uma pergunta mais completa.');
      return;
    }
    setBusy(true);
    try {
      const r = await respond({ query: query.trim() });
      setAnswer(r.answer);
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card testID="anonymous-ai-open" onPress={() => setOpen(true)} style={styles.aiCard}>
        <View style={styles.aiAvatar}>
          <Icon name={{ sf: 'eye.slash.fill', ion: 'eye-off' }} size={20} color={theme.topic.contraception.on} />
        </View>
        <View style={styles.aiMeta}>
          <Text style={styles.aiTitle}>Pergunta anónima</Text>
          <Text style={styles.aiSub}>Uma pergunta, sem guardar nada</Text>
        </View>
        <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={18} color={styles.chevron.color} />
      </Card>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Pergunta anónima</Text>
              <Pressable
                testID="anonymous-ai-close"
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                onPress={close}
                hitSlop={8}
              >
                <Icon name={{ sf: 'xmark', ion: 'close' }} size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.sheetNote}>
              Esta pergunta não é guardada na app, nem o teu histórico, nem é partilhada
              com um profissional. A resposta passa pelos mesmos validadores de segurança
              e é apenas informativa. Para casos urgentes liga 112 ou SNS 24 (808 24 24 24).
            </Text>

            {answer ? (
              <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerBox}>
                <Text style={styles.answerText} selectable>{answer}</Text>
              </ScrollView>
            ) : (
              <TextInput
                testID="anonymous-ai-input"
                multiline
                value={query}
                onChangeText={setQuery}
                placeholder="Escreve a tua pergunta..."
                placeholderTextColor={theme.colors.textTertiary as any}
                style={styles.sheetInput}
              />
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {answer ? (
              <Pressable testID="anonymous-ai-done" onPress={close} style={styles.sheetCta}>
                <Text style={styles.sheetCtaText}>Fechar (apaga tudo)</Text>
              </Pressable>
            ) : (
              <Pressable
                testID="anonymous-ai-submit"
                disabled={busy}
                onPress={submit}
                style={[styles.sheetCta, busy && styles.sheetCtaBusy]}
              >
                {busy && <ActivityIndicator color={theme.colors.onInk} size="small" />}
                <Text style={styles.sheetCtaText}>{busy ? 'A processar...' : 'Enviar'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function StartAiOnlyButton() {
  const router = useRouter();
  const create = useMutation(api.conversations.create);
  const [busy, setBusy] = useState(false);
  const { theme } = useUnistyles();

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const id = await create({ topic: 'general', title: 'Conversa com AI', kind: 'ai-only' });
      router.push({ pathname: '/(patient)/conversations/[id]', params: { id: id as any } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="start-ai-only" onPress={start} style={styles.aiCard}>
      <View style={[styles.aiAvatar, styles.aiAvatarMint]}>
        <Icon name={{ sf: 'sparkles', ion: 'sparkles' }} size={20} color={theme.topic.intimate.on} />
      </View>
      <View style={styles.aiMeta}>
        <Text style={styles.aiTitle}>Conversar com a assistente</Text>
        <Text style={styles.aiSub}>Fica no teu histórico · podes pedir uma profissional a qualquer momento</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={theme.colors.accent} size="small" />
      ) : (
        <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={18} color={styles.chevron.color} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  hero: { gap: theme.spacing.xs },
  greeting: { fontFamily: fonts.displayExtraBold, fontSize: 28, color: theme.colors.inkText },
  subtitle: { fontSize: 16, color: theme.colors.textSecondary },
  section: { gap: theme.spacing.md },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  sectionHead: { gap: 2 },
  sectionNote: { fontSize: 14, color: theme.colors.textSecondary },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  topicTile: {
    // Two per row; the gap is subtracted via flexBasis slightly under 50%.
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 88,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  topicTileLabel: { fontSize: 16, fontWeight: '600' },
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  // Care feed
  feed: { gap: theme.spacing.sm },
  feedCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  feedBody: { flex: 1, gap: 2 },
  feedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  feedName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, flex: 1 },
  feedTime: { fontSize: 12, color: theme.colors.textTertiary },
  feedTopic: { fontSize: 12, color: theme.colors.accent, fontWeight: '500' },
  feedPreview: { fontSize: 13, color: theme.colors.textSecondary },
  // Topic picker / topic cards
  chevron: { color: theme.colors.textTertiary },
  // AI cards
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.topic.contraception.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarMint: { backgroundColor: theme.topic.intimate.fill },
  aiMeta: { flex: 1, gap: 2 },
  aiTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  aiSub: { fontSize: 12, color: theme.colors.textSecondary },
  // Sheets
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23,17,43,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    maxHeight: '85%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  sheetNote: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },
  answerScroll: { maxHeight: 320 },
  answerBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  answerText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
  sheetInput: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  errorText: { fontSize: 14, color: theme.colors.danger },
  sheetCta: {
    backgroundColor: theme.colors.ink,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  sheetCtaBusy: { opacity: 0.7 },
  sheetCtaText: { fontSize: 15, fontFamily: fonts.displayBold, color: theme.colors.onInk },
}));
