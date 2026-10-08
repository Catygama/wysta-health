import { View, Text } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { RISK_LABELS, riskColor } from '@/constants/conversation';
import { AlertLevelBadge } from '@/components/AlertLevelBadge';
import type { AlertLevel } from '@/convex/lib/alerts';
import type { TopicId } from '@/convex/lib/topics';

type Props = {
  riskLevel?: string;
  alertLevel?: AlertLevel;
  responses: Record<string, unknown>;
  /** Topic of the triage: its questions give each answer its wording and order. */
  topic?: string;
};

// The patient's triage answers for the nurse: each question as it was asked,
// with the answer under it. Answers keep their question id; the wording comes
// from the topic's current questions (an id with no question shows as is).
export function TriageSummary({ riskLevel, alertLevel, responses, topic }: Props) {
  const { theme } = useUnistyles();
  const triage = useQuery(api.triage.getByTopic, topic ? { topic: topic as TopicId } : 'skip');
  const color = riskColor(theme, riskLevel ?? 'low') ?? theme.colors.textSecondary;

  const questions = triage?.questions ?? [];
  const asked = questions.filter((q) => q.id in responses);
  const unknown = Object.keys(responses).filter((id) => !questions.some((q) => q.id === id));
  const rows = [
    ...asked.map((q) => ({ id: q.id, question: q.question, value: responses[q.id] })),
    ...unknown.map((id) => ({ id, question: id, value: responses[id] })),
  ];
  if (rows.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name={{ sf: 'doc.text.fill', ion: 'document-text' }} size={16} color={theme.colors.inkText} />
        <Text style={styles.title}>Resumo de triagem</Text>
      </View>
      {alertLevel || riskLevel ? (
        <View style={styles.badges}>
          {alertLevel && <AlertLevelBadge level={alertLevel} testID="triage-summary-alert-level" />}
          {riskLevel && (
            <View style={[styles.riskBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.riskText, { color }]}>Risco {RISK_LABELS[riskLevel] ?? riskLevel}</Text>
            </View>
          )}
        </View>
      ) : null}
      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.question}>{r.question}</Text>
            <Text style={styles.answer}>{formatValue(r.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatValue(value: unknown): string {
  if (value === 'yes') return 'Sim';
  if (value === 'no') return 'Não';
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  title: { fontSize: 14, fontWeight: '600', color: theme.colors.inkText },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.xs },
  riskBadge: {
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  riskText: { fontSize: 12, fontWeight: '500' },
  rows: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  row: { gap: 2 },
  question: { fontSize: 13, color: theme.colors.textSecondary },
  answer: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
}));
