import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useAction } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { TOPIC_CHOICES, OTHER_TOPIC, type TopicColor } from '@/constants/topics';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { fonts } from '@/lib/fonts';
import type { ConversationMode } from '@/constants/conversation';

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
  const { theme } = useUnistyles();
  const user = useQuery(api.users.currentUser);
  const greeting =
    user?.profile?.displayName?.trim().split(/s+/)[0] || user?.email?.split('@')[0] || 'utente';
  // Which path the patient chose on Home; the topic picker is open while set.
  const [pickerMode, setPickerMode] = useState<ConversationMode | null>(null);

  function startTopic(topicId: string) {
    const mode = pickerMode ?? 'professional';
    setPickerMode(null);
    if (topicId === 'sexual-wellbeing') {
      router.push({ pathname: '/wellbeing', params: { mode } });
      return;
    }
    router.push({ pathname: '/triage', params: { topic: topicId, mode } });
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

      <View style={styles.section}>
        <PathCard
          testID="home-path-professional"
          icon={{ sf: 'stethoscope', ion: 'medkit-outline' }}
          iconFill={theme.topic.contraception.fill}
          title="Profissional de saúde"
          description="Responde a umas perguntas e um profissional responde-te em até 24h"
          onPress={() => setPickerMode('professional')}
        />
        <PathCard
          testID="home-path-ai"
          icon={{ sf: 'sparkles', ion: 'sparkles-outline' }}
          iconFill={theme.topic.intimate.fill}
          title="Assistente IA"
          description="Responde a umas perguntas e recebe resposta imediata. Podes pedir um profissional a qualquer momento"
          onPress={() => setPickerMode('ai')}
        />
        <AnonymousAiButton />
      </View>

      <TopicPickerSheet
        visible={pickerMode !== null}
        mode={pickerMode ?? 'professional'}
        onClose={() => setPickerMode(null)}
        onSelect={startTopic}
      />
    </ScrollView>
  );
}

function TopicPickerSheet({
  visible,
  mode,
  onClose,
  onSelect,
}: {
  visible: boolean;
  mode: ConversationMode;
  onClose: () => void;
  onSelect: (topicId: string) => void;
}) {
  const { theme } = useUnistyles();
  // Wide screens: two columns, so all topics fit without scrolling.
  const twoColumns = useWindowDimensions().width >= 640;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {mode === 'ai' ? 'Falar com a assistente IA' : 'Falar com um profissional'}
            </Text>
            <Pressable
              testID="topic-picker-close"
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={onClose}
              hitSlop={8}
            >
              <Icon name={{ sf: 'xmark', ion: 'close' }} size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetNote}>
            {mode === 'ai'
              ? 'Escolhe o tema. Depois de umas perguntas, a assistente responde-te na hora.'
              : 'Escolhe o tema. Depois de umas perguntas, um profissional responde-te em até 24h.'}
          </Text>
          <View style={[styles.topicList, twoColumns && styles.topicGrid]}>
            {/* The five topics, then the catch-all "general" as "Outro assunto". */}
            {[...TOPIC_CHOICES, OTHER_TOPIC].map((t) => (
              <Card
                key={t.id}
                testID={`topic-picker-${t.id}`}
                onPress={() => onSelect(t.id)}
                tone="sunken"
                style={[styles.topicCard, twoColumns && styles.topicCardHalf]}
              >
                <TopicIcon color={t.color} icon={t.icon} size={36} />
                <View style={styles.topicMeta}>
                  <Text style={styles.topicLabel}>
                    {t.id === OTHER_TOPIC.id ? 'Outro assunto' : t.label}
                  </Text>
                  <Text style={styles.topicDesc}>{t.description}</Text>
                </View>
                <Icon
                  name={{ sf: 'chevron.right', ion: 'chevron-forward' }}
                  size={18}
                  color={styles.chevron.color}
                />
              </Card>
            ))}
          </View>
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
      <Card
        testID="anonymous-ai-open"
        onPress={() => setOpen(true)}
        tone="sunken"
        style={styles.aiCard}
      >
        <View style={[styles.aiAvatar, styles.anonAvatar]}>
          <Icon name={{ sf: 'lock', ion: 'lock-closed-outline' }} size={18} color={theme.colors.ink} />
        </View>
        <View style={styles.aiMeta}>
          <Text style={styles.aiTitle}>Pergunta anónima</Text>
          <Text style={styles.aiSub}>Uma pergunta rápida à IA, não fica guardada</Text>
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

// Home entry for one of the two conversation paths (professional / AI).
function PathCard({
  testID,
  icon,
  iconFill,
  title,
  description,
  onPress,
}: {
  testID: string;
  icon: IconName;
  iconFill: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Card testID={testID} onPress={onPress} style={styles.pathCard}>
      <View style={styles.pathBody}>
        <View style={[styles.pathIcon, { backgroundColor: iconFill }]}>
          <Icon name={icon} size={20} color={theme.colors.ink} />
        </View>
        <Text style={styles.pathTitle}>{title}</Text>
        <Text style={styles.pathDesc}>{description}</Text>
      </View>
      <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={18} color={styles.chevron.color} />
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
  // Topic picker / topic cards
  topicList: { gap: theme.spacing.sm },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  // Two per row (basis below 50% leaves room for the gap; grow fills it).
  topicCardHalf: { flexGrow: 1, flexBasis: '45%' },
  topicIcon: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  topicMeta: { flex: 1, gap: 2 },
  topicLabel: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  topicDesc: { fontSize: 13, color: theme.colors.textSecondary },
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
  anonAvatar: { backgroundColor: theme.colors.surface },
  // Home path cards
  pathCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md },
  pathBody: { flex: 1, gap: theme.spacing.xs },
  pathIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  pathTitle: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  pathDesc: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  aiMeta: { flex: 1, gap: 2 },
  aiTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  aiSub: { fontSize: 12, color: theme.colors.textSecondary },
  // Sheets
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
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
