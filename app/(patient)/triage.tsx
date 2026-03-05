import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { UrgencyAlert } from '@/screens/UrgencyAlert';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { TOPICS, type TopicId } from '@/constants/topics';

export default function Triage() {
  const { topic } = useLocalSearchParams<{ topic: TopicId }>();
  const router = useRouter();
  const triage = useQuery(api.triage.getByTopic, topic ? { topic } : 'skip');
  const createConversation = useMutation(api.conversations.create);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showUrgency, setShowUrgency] = useState(false);
  const [loading, setLoading] = useState(false);

  const topicInfo = TOPICS.find((t) => t.id === topic);

  function hasRedFlag() {
    if (!triage) return false;
    return triage.questions.some(
      (q) => q.isRedFlag && answers[q.id] === 'yes'
    );
  }

  async function createConversationAndNavigate() {
    setLoading(true);
    try {
      const id = await createConversation({
        topic: topic!,
        title: `${topicInfo?.label} — nova conversa`,
        priority: 'low',
      });
      router.replace({
        pathname: '/(patient)/conversations/[id]',
        params: { id },
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (hasRedFlag()) {
      setShowUrgency(true);
      return;
    }
    await createConversationAndNavigate();
  }

  if (!triage) {
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
        <Text style={{ ...typography.lg, color: colors.text.primary }}>
          {topicInfo?.emoji} {topicInfo?.label}
        </Text>
        <Button
          label="Iniciar conversa"
          onPress={createConversationAndNavigate}
          loading={loading}
        />
      </View>
    );
  }

  const allRequired = triage.questions
    .filter((q) => q.required)
    .every((q) => answers[q.id]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={{ ...typography['2xl'], fontWeight: '700', color: colors.text.primary }}>
        {topicInfo?.emoji} {topicInfo?.label}
      </Text>
      <Text style={{ ...typography.base, color: colors.text.secondary }}>
        Responde a algumas perguntas para que o profissional de saúde te possa ajudar melhor.
      </Text>

      {showUrgency && (
        <UrgencyAlert onDismiss={() => setShowUrgency(false)} />
      )}

      {triage.questions.map((q) => (
        <View key={q.id} style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }}>
            {q.question}
            {q.required && <Text style={{ color: colors.danger }}> *</Text>}
          </Text>

          {q.type === 'yes-no' && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {['yes', 'no'].map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: answers[q.id] === opt ? colors.primary : colors.border,
                    backgroundColor:
                      answers[q.id] === opt ? colors.primaryLight : colors.background.primary,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      ...typography.base,
                      fontWeight: '500',
                      color: answers[q.id] === opt ? colors.primary : colors.text.primary,
                    }}
                  >
                    {opt === 'yes' ? 'Sim' : 'Não'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {q.type === 'multiple-choice' && q.options && (
            <View style={{ gap: spacing.sm }}>
              {q.options.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: answers[q.id] === opt ? colors.primary : colors.border,
                    backgroundColor:
                      answers[q.id] === opt ? colors.primaryLight : colors.background.primary,
                  }}
                >
                  <Text
                    style={{
                      ...typography.base,
                      color: answers[q.id] === opt ? colors.primary : colors.text.primary,
                    }}
                  >
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}

      <Button
        label="Continuar"
        onPress={handleSubmit}
        loading={loading}
        disabled={!allRequired}
      />
    </ScrollView>
  );
}
