import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { UrgencyAlert } from '@/screens/UrgencyAlert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fonts } from '@/lib/fonts';
import { TOPIC_BY_ID } from '@/constants/topics';
import { kindForMode, type ConversationMode } from '@/constants/conversation';

type Phase = 'goals' | 'pain-check' | 'checkin';

const GOALS = [
  { id: 'desejo', label: 'Reacender o desejo', icon: { sf: 'flame', ion: 'flame-outline' } },
  { id: 'prazer', label: 'Prazer e orgasmo', icon: { sf: 'sparkles', ion: 'sparkles-outline' } },
  { id: 'dor', label: 'Dor ou desconforto', icon: { sf: 'bandage', ion: 'medkit-outline' } },
  { id: 'comunicar', label: 'Comunicar com o par', icon: { sf: 'bubble.left.and.bubble.right', ion: 'chatbubbles-outline' } },
  { id: 'autoconhecimento', label: 'Autoconhecimento', icon: { sf: 'heart.text.square', ion: 'heart-outline' } },
] as const;

const PAIN_REDFLAGS = [
  'Tens dor persistente há semanas?',
  'Tens sangramento associado às relações?',
  'A dor impede-te de ter relações?',
] as const;

const CHECKIN = [
  { key: 'desire', label: 'Desejo sexual', min: 1, max: 5, low: 'Muito baixo', high: 'Muito alto' },
  { key: 'satisfaction', label: 'Satisfação', min: 1, max: 5, low: 'Nada satisfeita', high: 'Muito satisfeita' },
  { key: 'pain', label: 'Dor nas relações', min: 0, max: 5, low: 'Sem dor', high: 'Dor intensa' },
  { key: 'distress', label: 'Preocupação / mal-estar', min: 1, max: 5, low: 'Nenhuma', high: 'Muita' },
] as const;

export default function Wellbeing() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: ConversationMode }>();
  const { user, isLoading: authLoading, role } = useCurrentUser();
  const { theme } = useUnistyles();
  const createConversation = useMutation(api.conversations.create);
  const submitCheckin = useMutation(api.wellbeing.submitCheckin);
  // Came for a professional and already has one open on this topic: go there.
  const openByTopic = useQuery(
    api.conversations.openProfessionalByTopic,
    user && mode === 'professional' ? {} : 'skip',
  );
  const pastel = theme.topic.wellbeing;

  const [phase, setPhase] = useState<Phase>('goals');
  const [goal, setGoal] = useState<(typeof GOALS)[number] | null>(null);
  const [painAnswers, setPainAnswers] = useState<Record<number, 'yes' | 'no'>>({});
  const [showUrgency, setShowUrgency] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== 'patient') return <Redirect href="/" />;
  const openId = mode === 'professional' ? openByTopic?.['sexual-wellbeing'] : undefined;
  if (openId) {
    return <Redirect href={{ pathname: '/(patient)/conversations/[id]', params: { id: openId } }} />;
  }

  function pickGoal(g: (typeof GOALS)[number]) {
    setGoal(g);
    setPhase(g.id === 'dor' ? 'pain-check' : 'checkin');
  }

  function answerPain(idx: number, value: 'yes' | 'no') {
    const next = { ...painAnswers, [idx]: value };
    setPainAnswers(next);
    if (value === 'yes') setShowUrgency(true);
  }

  async function finish(withCheckin: boolean) {
    if (!goal) return;
    setLoading(true);
    try {
      if (withCheckin && CHECKIN.every((c) => scores[c.key] !== undefined)) {
        await submitCheckin({
          desire: scores.desire,
          satisfaction: scores.satisfaction,
          pain: scores.pain,
          distress: scores.distress,
        });
      }
      const id = await createConversation({
        topic: 'sexual-wellbeing',
        title: `Bem-estar sexual — ${goal.label}`,
        wellbeingGoal: goal.label,
        // Pain/discomfort always routes to a professional (safety). Other goals
        // follow the path chosen on Home, AI-first when none was given.
        kind: goal.id === 'dor' ? 'human-async' : mode ? kindForMode(mode) : 'ai-only',
      });
      router.replace({ pathname: '/(patient)/conversations/[id]', params: { id } });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.inkText} />
        <Text style={styles.loadingText}>A preparar o teu espaço...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="wellbeing-screen"
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.titleRow}>
        <View style={[styles.topicChip, { backgroundColor: pastel.fill }]}>
          <Icon name={TOPIC_BY_ID['sexual-wellbeing'].icon} size={20} color={pastel.on} />
        </View>
        <Text style={styles.title}>Bem-estar sexual</Text>
      </View>

      {showUrgency && <UrgencyAlert onDismiss={() => setShowUrgency(false)} />}

      {phase === 'goals' && (
        <View style={styles.section}>
          <Text style={styles.lead}>Sobre o que queres conversar?</Text>
          <View style={styles.goalList}>
            {GOALS.map((g) => (
              <Pressable
                key={g.id}
                testID={`wellbeing-goal-${g.id}`}
                onPress={() => pickGoal(g)}
                style={styles.goalCard}
              >
                <View style={[styles.goalIcon, { backgroundColor: pastel.fill }]}>
                  <Icon name={g.icon} size={22} color={pastel.on} />
                </View>
                <Text style={styles.goalLabel}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {phase === 'pain-check' && (
        <View style={styles.section}>
          <Text style={styles.lead}>Antes de avançar, algumas perguntas rápidas:</Text>
          {PAIN_REDFLAGS.map((q, idx) => (
            <View key={idx} style={styles.card}>
              <Text style={styles.question}>{q}</Text>
              <View style={styles.yesNoRow}>
                {(['yes', 'no'] as const).map((opt) => {
                  const selected = painAnswers[idx] === opt;
                  return (
                    <Pressable
                      key={opt}
                      testID={`wellbeing-pain-${idx}-${opt}`}
                      onPress={() => answerPain(idx, opt)}
                      style={[styles.yesNo, selected ? styles.optOn : styles.optOff]}
                    >
                      <Text style={[styles.optText, selected ? styles.optTextOn : styles.optTextOff]}>
                        {opt === 'yes' ? 'Sim' : 'Não'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <Text style={styles.note}>
            Dor persistente merece avaliação de um profissional — vamos encaminhar-te.
          </Text>
          <Button
            testID="wellbeing-pain-continue"
            label="Continuar"
            onPress={() => setPhase('checkin')}
            disabled={PAIN_REDFLAGS.some((_, idx) => !painAnswers[idx])}
          />
        </View>
      )}

      {phase === 'checkin' && (
        <View style={styles.section}>
          <Text style={styles.lead}>Como te tens sentido? (opcional)</Text>
          <Text style={styles.sub}>
            Ajuda-nos a acompanhar a tua evolução. Podes saltar.
          </Text>
          {CHECKIN.map((c) => (
            <View key={c.key} style={styles.card}>
              <Text style={styles.question}>{c.label}</Text>
              <View style={styles.scaleRow}>
                {Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i).map((value) => {
                  const selected = scores[c.key] === value;
                  return (
                    <Pressable
                      key={value}
                      testID={`wellbeing-scale-${c.key}-${value}`}
                      onPress={() => setScores((s) => ({ ...s, [c.key]: value }))}
                      style={[styles.scaleCell, selected ? styles.optOn : styles.optOff]}
                    >
                      <Text style={[styles.optText, selected ? styles.optTextOn : styles.optTextOff]}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.scaleLabels}>
                <Text style={styles.scaleHint}>{c.low}</Text>
                <Text style={styles.scaleHint}>{c.high}</Text>
              </View>
            </View>
          ))}
          <Button
            testID="wellbeing-finish"
            label="Começar conversa"
            onPress={() => finish(true)}
          />
          <Pressable testID="wellbeing-skip" onPress={() => finish(false)} hitSlop={8}>
            <Text style={styles.skip}>Saltar check-in e começar</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backWrap}>
        <Text style={styles.navLink}>← Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: theme.spacing.md, backgroundColor: theme.colors.background,
  },
  loadingText: { fontSize: 16, color: theme.colors.textSecondary },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  topicChip: {
    width: 40, height: 40, borderRadius: 20, borderCurve: 'continuous',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: theme.colors.inkText },
  section: { gap: theme.spacing.md },
  lead: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  sub: { fontSize: 14, color: theme.colors.textSecondary },
  note: { fontSize: 13, color: theme.colors.textSecondary },
  goalList: { gap: theme.spacing.sm },
  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderCurve: 'continuous', padding: theme.spacing.md,
  },
  goalIcon: {
    width: 44, height: 44, borderRadius: 22, borderCurve: 'continuous',
    alignItems: 'center', justifyContent: 'center',
  },
  goalLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, flex: 1 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderCurve: 'continuous', padding: theme.spacing.lg, gap: theme.spacing.md,
  },
  question: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  yesNoRow: { flexDirection: 'row', gap: theme.spacing.sm },
  yesNo: {
    flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md,
    borderCurve: 'continuous', alignItems: 'center',
  },
  optOn: { backgroundColor: theme.colors.ink },
  optOff: { backgroundColor: theme.colors.surfaceSunken },
  optText: { fontSize: 16, fontWeight: '500' },
  optTextOn: { color: theme.colors.onInk },
  optTextOff: { color: theme.colors.textPrimary },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  scaleCell: {
    width: 44, height: 44, borderRadius: theme.radius.md, borderCurve: 'continuous',
    alignItems: 'center', justifyContent: 'center',
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleHint: { fontSize: 12, color: theme.colors.textTertiary },
  skip: { fontSize: 14, color: theme.colors.accent, fontWeight: '500', textAlign: 'center' },
  backWrap: { paddingVertical: theme.spacing.sm },
  navLink: { fontSize: 14, color: theme.colors.accent, fontWeight: '500' },
}));
