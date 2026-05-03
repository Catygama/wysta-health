import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { UrgencyAlert } from '@/screens/UrgencyAlert';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { TOPICS, type TopicId } from '@/constants/topics';

type Question = {
  id: string;
  question: string;
  type: 'multiple-choice' | 'yes-no' | 'scale' | 'text';
  options?: string[];
  isRedFlag?: boolean;
  required: boolean;
};

export default function Triage() {
  const { topic } = useLocalSearchParams<{ topic: TopicId }>();
  const router = useRouter();
  const triage = useQuery(api.triage.getByTopic, topic ? { topic } : 'skip');
  const createConversation = useMutation(api.conversations.create);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [showUrgency, setShowUrgency] = useState(false);
  const [loading, setLoading] = useState(false);

  const topicInfo = TOPICS.find((t) => t.id === topic);
  const questions = (triage?.questions ?? []) as Question[];
  const total = questions.length;
  const current = questions[step];
  const isLast = step === total - 1;

  const redFlagTriggered = useMemo(() => {
    return questions.some((q) => {
      if (!q.isRedFlag) return false;
      const a = answers[q.id];
      if (a === 'yes') return true;
      if (typeof a === 'number' && a >= 9) return true;
      return false;
    });
  }, [questions, answers]);

  async function submit() {
    if (!topic) return;
    setLoading(true);
    try {
      const id = await createConversation({
        topic,
        title: `${topicInfo?.label} — nova conversa`,
        triageData: { responses: answers },
      });
      router.replace({
        pathname: '/(patient)/conversations/[id]',
        params: { id },
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(value: string | number) {
    if (!current) return;
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    if (current.isRedFlag && value === 'yes') {
      setShowUrgency(true);
    }
    if (isLast) {
      submit();
    } else {
      setStep((s) => s + 1);
    }
  }

  if (!topic) return null;

  if (triage === undefined) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!triage || total === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        {topicInfo && (
          <Icon name={topicInfo.icon} size={48} color={colors.primary} />
        )}
        <Text
          style={{
            ...typography.lg,
            fontWeight: '600',
            color: colors.text.primary,
          }}
        >
          {topicInfo?.label}
        </Text>
        <Text
          style={{
            ...typography.sm,
            color: colors.text.secondary,
            textAlign: 'center',
          }}
        >
          Ainda não há triagem para este tópico. Podes iniciar a conversa diretamente.
        </Text>
        <Button
          label="Iniciar conversa"
          onPress={async () => {
            setLoading(true);
            try {
              const id = await createConversation({
                topic,
                title: `${topicInfo?.label} — nova conversa`,
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
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ ...typography.base, color: colors.text.secondary }}>
          A criar a tua conversa...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          {topicInfo && (
            <Icon name={topicInfo.icon} size={28} color={colors.primary} />
          )}
          <Text
            style={{
              ...typography['2xl'],
              fontWeight: '700',
              color: colors.text.primary,
            }}
          >
            {topicInfo?.label}
          </Text>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text
            style={{ ...typography.xs, color: colors.text.secondary }}
          >
            Pergunta {step + 1} de {total}
          </Text>
          <View
            style={{
              height: 6,
              backgroundColor: colors.background.tertiary,
              borderRadius: radius.full,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 6,
                width: `${((step + 1) / total) * 100}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </View>
      </View>

      {showUrgency && <UrgencyAlert onDismiss={() => setShowUrgency(false)} />}

      <View
        style={{
          backgroundColor: colors.background.primary,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <Text
          style={{
            ...typography.lg,
            fontWeight: '600',
            color: colors.text.primary,
          }}
        >
          {current.question}
          {current.required && (
            <Text style={{ color: colors.danger }}> *</Text>
          )}
        </Text>

        {current.type === 'yes-no' && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['yes', 'no'] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => handleAnswer(opt)}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor:
                    answers[current.id] === opt
                      ? colors.primary
                      : colors.border,
                  backgroundColor:
                    answers[current.id] === opt
                      ? colors.primaryLight
                      : pressed
                        ? colors.background.tertiary
                        : colors.background.primary,
                  alignItems: 'center',
                })}
              >
                <Text
                  style={{
                    ...typography.base,
                    fontWeight: '600',
                    color:
                      answers[current.id] === opt
                        ? colors.primary
                        : colors.text.primary,
                  }}
                >
                  {opt === 'yes' ? 'Sim' : 'Não'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {current.type === 'multiple-choice' && current.options && (
          <View style={{ gap: spacing.sm }}>
            {current.options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => handleAnswer(opt)}
                style={({ pressed }) => ({
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor:
                    answers[current.id] === opt
                      ? colors.primary
                      : colors.border,
                  backgroundColor:
                    answers[current.id] === opt
                      ? colors.primaryLight
                      : pressed
                        ? colors.background.tertiary
                        : colors.background.primary,
                })}
              >
                <Text
                  style={{
                    ...typography.base,
                    color:
                      answers[current.id] === opt
                        ? colors.primary
                        : colors.text.primary,
                  }}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {current.type === 'scale' && current.options && (
          <View style={{ gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.xs,
              }}
            >
              {current.options.map((opt) => {
                const value = Number(opt);
                const selected = answers[current.id] === value;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => handleAnswer(value)}
                    style={({ pressed }) => ({
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primary
                        : pressed
                          ? colors.background.tertiary
                          : colors.background.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    })}
                  >
                    <Text
                      style={{
                        ...typography.base,
                        fontWeight: '600',
                        color: selected ? '#fff' : colors.text.primary,
                      }}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{ ...typography.xs, color: colors.text.tertiary }}
              >
                Sem dor
              </Text>
              <Text
                style={{ ...typography.xs, color: colors.text.tertiary }}
              >
                Dor máxima
              </Text>
            </View>
          </View>
        )}

        {current.type === 'text' && (
          <View style={{ gap: spacing.sm }}>
            <TextInput
              value={String(answers[current.id] ?? '')}
              onChangeText={(v) =>
                setAnswers({ ...answers, [current.id]: v })
              }
              placeholder="Descreve os teus sintomas ou dúvidas..."
              multiline
              numberOfLines={4}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                ...typography.base,
                color: colors.text.primary,
                backgroundColor: colors.background.primary,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
            <Button
              label={isLast ? 'Concluir' : 'Continuar'}
              onPress={() => handleAnswer(String(answers[current.id] ?? ''))}
              disabled={
                current.required &&
                !String(answers[current.id] ?? '').trim()
              }
            />
          </View>
        )}
      </View>

      {current.isRedFlag && (
        <View
          style={{
            padding: spacing.md,
            backgroundColor: colors.dangerLight,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.danger,
            flexDirection: 'row',
            gap: spacing.sm,
          }}
        >
          <Icon
            name={{
              sf: 'exclamationmark.triangle.fill',
              ion: 'warning',
            }}
            size={18}
            color={colors.danger}
          />
          <Text
            style={{
              ...typography.sm,
              color: colors.danger,
              flex: 1,
            }}
          >
            Se tiveres sintomas graves, liga 112 ou contacta o SNS 24.
          </Text>
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
          hitSlop={8}
        >
          <Text
            style={{
              ...typography.sm,
              color: colors.primary,
              fontWeight: '500',
            }}
          >
            ← {step > 0 ? 'Pergunta anterior' : 'Voltar'}
          </Text>
        </Pressable>
        {redFlagTriggered && (
          <Pressable onPress={() => setShowUrgency(true)} hitSlop={8}>
            <Text
              style={{
                ...typography.sm,
                color: colors.danger,
                fontWeight: '600',
              }}
            >
              Ver aviso urgente
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}
