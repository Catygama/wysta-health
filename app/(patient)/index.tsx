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
import { TOPICS, type TopicColor } from '@/constants/topics';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { fonts } from '@/lib/fonts';
import { relativeTime } from '@/lib/format';

function TopicIcon({ color, icon, size = 44 }: { color: TopicColor; icon: IconName; size?: number }) {
  const { theme } = useUnistyles();
  const pastel = theme.topic[color];
  return (
    <View
      style={[
        styles.topicIcon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pastel.fill },
      ]}
    >
      <Icon name={icon} size={size * 0.5} color={pastel.on} />
    </View>
  );
}

export default function PatientHome() {
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const conversations = useQuery(api.conversations.listForPatient) ?? [];
  const greeting = user?.profile?.displayName || user?.email?.split('@')[0] || 'utente';
  const [pickerOpen, setPickerOpen] = useState(false);

  const active = conversations.filter((c) => c.status !== 'closed');

  function startTopic(topicId: string) {
    setPickerOpen(false);
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

      <View style={styles.section}>
        <Button
          testID="patient-new-conversation"
          label="Começar nova conversa"
          onPress={() => setPickerOpen(true)}
        />
        <View style={styles.chipRow}>
          {TOPICS.map((t) => (
            <Chip
              key={t.id}
              testID={`patient-topic-chip-${t.id}`}
              label={t.label}
              topic={t.color}
              onPress={() => startTopic(t.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AnonymousAiButton />
        <StartAiOnlyButton />
      </View>

      <TopicPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={startTopic}
      />
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

function TopicPickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (topicId: string) => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Nova conversa</Text>
            <Pressable testID="topic-picker-close" onPress={onClose} hitSlop={8}>
              <Icon name={{ sf: 'xmark', ion: 'close' }} size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetNote}>
            Escolhe o tema para começares. As respostas chegam normalmente em 24h.
          </Text>
          <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.topicList}>
            {TOPICS.map((t) => (
              <Card
                key={t.id}
                testID={`topic-picker-${t.id}`}
                onPress={() => onSelect(t.id)}
                tone="sunken"
                style={styles.topicCard}
              >
                <TopicIcon color={t.color} icon={t.icon} />
                <View style={styles.topicMeta}>
                  <Text style={styles.topicLabel}>{t.label}</Text>
                  <Text style={styles.topicDesc}>{t.description}</Text>
                </View>
                <Icon
                  name={{ sf: 'chevron.right', ion: 'chevron-forward' }}
                  size={18}
                  color={styles.chevron.color}
                />
              </Card>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
          <Text style={styles.aiSparkle}>✨</Text>
        </View>
        <View style={styles.aiMeta}>
          <Text style={styles.aiTitle}>Pergunta anónima à AI</Text>
          <Text style={styles.aiSub}>Não fica guardado no teu histórico</Text>
        </View>
        <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={18} color={styles.chevron.color} />
      </Card>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>✨ Pergunta anónima</Text>
              <Pressable testID="anonymous-ai-close" onPress={close} hitSlop={8}>
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
        <Text style={styles.aiSparkle}>💬</Text>
      </View>
      <View style={styles.aiMeta}>
        <Text style={styles.aiTitle}>Conversar só com AI</Text>
        <Text style={styles.aiSub}>Resposta imediata · podes pedir profissional a qualquer momento</Text>
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
  greeting: { fontFamily: fonts.displayExtraBold, fontSize: 28, color: theme.colors.ink },
  subtitle: { fontSize: 16, color: theme.colors.textSecondary },
  section: { gap: theme.spacing.md },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
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
  topicList: { gap: theme.spacing.sm },
  topicCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  topicIcon: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  topicMeta: { flex: 1, gap: 2 },
  topicLabel: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  topicDesc: { fontSize: 13, color: theme.colors.textSecondary },
  chevron: { color: theme.colors.textTertiary },
  pickerScroll: { maxHeight: 420 },
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
  aiSparkle: { fontSize: 18 },
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
