import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { UrgencyAlert } from '@/screens/UrgencyAlert';
import { TOPICS, type TopicId } from '@/constants/topics';
import { kindForMode, type ConversationMode } from '@/constants/conversation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fonts } from '@/lib/fonts';

type Question = {
  id: string;
  question: string;
  type: 'multiple-choice' | 'yes-no' | 'scale' | 'text';
  options?: string[];
  isRedFlag?: boolean;
  required: boolean;
};

// A 'yes' on a yes/no red flag, or 9+ on a 0–10 scale red flag.
function isRedFlagAnswer(value: string | number | undefined): boolean {
  return value === 'yes' || (typeof value === 'number' && value >= 9);
}

export default function Triage() {
  // `mode` is the path chosen on Home (professional / ai); it decides the
  // conversation kind created when the questionnaire ends.
  const { topic, mode } = useLocalSearchParams<{ topic: TopicId; mode?: ConversationMode }>();
  const router = useRouter();
  const { user, isLoading: authLoading, role } = useCurrentUser();
  const { theme } = useUnistyles();
  const triage = useQuery(api.triage.getByTopic, topic ? { topic } : 'skip');
  const createConversation = useMutation(api.conversations.create);
  // One open professional conversation per topic: if there is one, skip the
  // questionnaire and go straight to it.
  const wantsProfessional = kindForMode(mode) === 'human-async';
  const openByTopic = useQuery(
    api.conversations.openProfessionalByTopic,
    user && wantsProfessional ? {} : 'skip',
  );

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [showUrgency, setShowUrgency] = useState(false);
  // Answers held back while the urgency alert is showing; applied on dismiss.
  const [pendingAdvance, setPendingAdvance] = useState<Record<string, string | number> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const topicInfo = TOPICS.find((t) => t.id === topic);
  const pastel = theme.topic[topicInfo?.color ?? 'general'];
  const questions = useMemo(() => (triage?.questions ?? []) as Question[], [triage]);
  const total = questions.length;
  const current = questions[step];
  const isLast = step === total - 1;

  const redFlagTriggered = useMemo(() => {
    return questions.some((q) => q.isRedFlag && isRedFlagAnswer(answers[q.id]));
  }, [questions, answers]);

  // Takes the responses explicitly: callers pass the just-updated answers, which
  // aren't in `answers` state until the next render.
  async function submit(responses: Record<string, string | number>) {
    if (!topic) return;
    setLoading(true);
    try {
      const id = await createConversation({
        topic,
        title: `${topicInfo?.label} — nova conversa`,
        triageData: { responses },
        kind: kindForMode(mode),
      });
      router.replace({ pathname: '/(patient)/conversations/[id]', params: { id } });
    } finally {
      setLoading(false);
    }
  }

  function advance(responses: Record<string, string | number>) {
    if (isLast) {
      submit(responses);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleAnswer(value: string | number) {
    if (!current) return;
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    if (current.isRedFlag && isRedFlagAnswer(value)) {
      // Stop here so the alert is actually seen: advancing (or submitting, on
      // the last question) would navigate away from it. The patient moves on
      // only by dismissing it.
      setPendingAdvance(next);
      setShowUrgency(true);
      return;
    }
    advance(next);
  }

  function dismissUrgency() {
    setShowUrgency(false);
    if (pendingAdvance) {
      const responses = pendingAdvance;
      setPendingAdvance(null);
      advance(responses);
    }
  }

  if (!topic) return null;
  if (authLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== 'patient') return <Redirect href="/" />;

  const openId = wantsProfessional ? openByTopic?.[topic] : undefined;
  if (openId) {
    return <Redirect href={{ pathname: '/(patient)/conversations/[id]', params: { id: openId } }} />;
  }

  if (triage === undefined || (wantsProfessional && openByTopic === undefined)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }

  if (!triage || total === 0) {
    return (
      <View style={styles.fallback}>
        {topicInfo && (
          <View style={[styles.bigIcon, { backgroundColor: pastel.fill }]}>
            <Icon name={topicInfo.icon} size={32} color={pastel.on} />
          </View>
        )}
        <Text style={styles.fallbackTitle}>{topicInfo?.label}</Text>
        <Text style={styles.fallbackSub}>
          Ainda não há triagem para este tópico. Podes iniciar a conversa diretamente.
        </Text>
        <View style={styles.fallbackCta}>
          <Button
            label="Iniciar conversa"
            onPress={async () => {
              setLoading(true);
              try {
                const id = await createConversation({
                  topic,
                  title: `${topicInfo?.label} — nova conversa`,
                  kind: kindForMode(mode),
                });
                router.replace({
                  pathname: '/(patient)/conversations/[id]',
                  params: { id },
                });
              } finally {
                setLoading(false);
              }
            }}
            loading={loading}
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.inkText} />
        <Text style={styles.loadingText}>A criar a tua conversa...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="triage-screen"
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.head}>
        {/* Test hook for e2e; hidden from screen readers, which would read the JSON. */}
        <Text testID="triage-current-meta" style={styles.srOnly} aria-hidden>
          {JSON.stringify({
            id: current.id,
            type: current.type,
            isRedFlag: current.isRedFlag ?? false,
            options: current.options ?? null,
            step,
            total,
            isLast,
          })}
        </Text>
        <Pressable
          testID="triage-back"
          accessibilityRole="button"
          accessibilityLabel={step > 0 ? 'Pergunta anterior' : 'Voltar'}
          onPress={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
        >
          <Icon
            name={{ sf: 'chevron.left', ion: 'chevron-back' }}
            size={20}
            color={theme.colors.textPrimary}
          />
          <Text style={styles.backLabel}>{step > 0 ? 'Anterior' : 'Voltar'}</Text>
        </Pressable>
        <View style={styles.titleRow}>
          {topicInfo && (
            <View style={[styles.topicChip, { backgroundColor: pastel.fill }]}>
              <Icon name={topicInfo.icon} size={20} color={pastel.on} />
            </View>
          )}
          <Text style={styles.title}>{topicInfo?.label}</Text>
        </View>

        <View style={styles.progressWrap}>
          <Text style={styles.progressLabel}>
            Pergunta {step + 1} de {total}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / total) * 100}%` }]} />
          </View>
        </View>
      </View>

      {showUrgency && <UrgencyAlert onDismiss={dismissUrgency} />}

      <View style={styles.card}>
        <Text style={styles.question}>
          {current.question}
          {current.required && <Text style={styles.required}> *</Text>}
        </Text>

        {current.type === 'yes-no' && (
          <View style={styles.yesNoRow}>
            {(['yes', 'no'] as const).map((opt) => {
              const selected = answers[current.id] === opt;
              return (
                <Pressable
                  key={opt}
                  testID={`triage-option-${opt}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => handleAnswer(opt)}
                  style={[styles.yesNo, selected ? styles.optOn : styles.optOff]}
                >
                  <Text style={[styles.optText, selected ? styles.optTextOn : styles.optTextOff]}>
                    {opt === 'yes' ? 'Sim' : 'Não'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {current.type === 'multiple-choice' && current.options && (
          <View style={styles.optionList}>
            {current.options.map((opt, idx) => {
              const selected = answers[current.id] === opt;
              return (
                <Pressable
                  key={opt}
                  testID={`triage-option-${idx}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => handleAnswer(opt)}
                  style={[styles.option, selected ? styles.optOn : styles.optOff]}
                >
                  <Text style={[styles.optText, selected ? styles.optTextOn : styles.optTextOff]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {current.type === 'scale' && current.options && (
          <View style={styles.scaleWrap}>
            <View style={styles.scaleRow}>
              {current.options.map((opt) => {
                const value = Number(opt);
                const selected = answers[current.id] === value;
                return (
                  <Pressable
                    key={opt}
                    testID={`triage-scale-${opt}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${opt} de ${current.options!.length}`}
                    accessibilityState={{ selected }}
                    onPress={() => handleAnswer(value)}
                    style={[styles.scaleCell, selected ? styles.optOn : styles.optOff]}
                  >
                    <Text style={[styles.optText, selected ? styles.optTextOn : styles.optTextOff]}>
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleHint}>{current.options[0]} · Pouca dor</Text>
              <Text style={styles.scaleHint}>
                Dor máxima · {current.options[current.options.length - 1]}
              </Text>
            </View>
          </View>
        )}

        {current.type === 'text' && (
          <View style={styles.textWrap}>
            <TextInput
              testID="triage-text-input"
              value={String(answers[current.id] ?? '')}
              onChangeText={(v) => setAnswers({ ...answers, [current.id]: v })}
              placeholder="Descreve os teus sintomas ou dúvidas..."
              placeholderTextColor={theme.colors.textTertiary as any}
              multiline
              numberOfLines={4}
              style={styles.textInput}
            />
            <Button
              testID="triage-text-submit"
              label={isLast ? 'Concluir' : 'Continuar'}
              onPress={() => handleAnswer(String(answers[current.id] ?? ''))}
              disabled={current.required && !String(answers[current.id] ?? '').trim()}
            />
          </View>
        )}
      </View>

      {current.isRedFlag && (
        <View style={styles.redFlag}>
          <Icon
            name={{ sf: 'exclamationmark.triangle.fill', ion: 'warning' }}
            size={18}
            color={theme.colors.danger}
          />
          <Text style={styles.redFlagText}>
            Se tiveres sintomas graves, liga 112 ou contacta o SNS 24.
          </Text>
        </View>
      )}

      {redFlagTriggered && !showUrgency && (
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowUrgency(true)}
            hitSlop={8}
            style={styles.navUrgentButton}
          >
            <Text style={styles.navUrgent}>Ver aviso urgente</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  loadingText: { fontSize: 16, color: theme.colors.textSecondary },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  fallbackSub: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  fallbackCta: { width: '100%', maxWidth: 320 },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  head: { gap: theme.spacing.sm },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  topicChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: theme.colors.inkText },
  progressWrap: { gap: theme.spacing.xs },
  progressLabel: { fontSize: 12, color: theme.colors.textSecondary },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: theme.colors.ink },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  question: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  required: { color: theme.colors.danger },
  yesNoRow: { flexDirection: 'row', gap: theme.spacing.sm },
  yesNo: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  optionList: { gap: theme.spacing.sm },
  option: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  optOn: { backgroundColor: theme.colors.ink },
  optOff: { backgroundColor: theme.colors.surfaceSunken },
  optText: { fontSize: 16, fontWeight: '500' },
  optTextOn: { color: theme.colors.onInk },
  optTextOff: { color: theme.colors.textPrimary },
  scaleWrap: { gap: theme.spacing.sm },
  // Even 5-per-row grid, so 1–10 reads as two clean rows on any phone width.
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  scaleCell: {
    flexBasis: '17%',
    flexGrow: 1,
    height: 52,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleHint: { fontSize: 13, color: theme.colors.textSecondary },
  textWrap: { gap: theme.spacing.sm },
  textInput: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  redFlag: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  redFlagText: { fontSize: 14, color: theme.colors.danger, flex: 1 },
  nav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  navUrgentButton: { minHeight: 44, justifyContent: 'center' },
  navUrgent: { fontSize: 15, color: theme.colors.danger, fontWeight: '600' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    minHeight: 44,
    paddingRight: theme.spacing.sm,
    marginLeft: -theme.spacing.xs,
  },
  backPressed: { opacity: 0.6 },
  backLabel: { fontSize: 16, color: theme.colors.textPrimary, fontWeight: '500' },
}));
