import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';
import { RISK_LABELS, riskColor } from '@/constants/conversation';


type Props = {
  riskLevel?: string;
  responses: Record<string, unknown>;
  questionLabels?: Record<string, string>;
};

export function TriageSummary({ riskLevel, responses, questionLabels }: Props) {
  const { theme } = useUnistyles();
  const color = riskColor(theme, riskLevel ?? 'low') ?? theme.colors.textSecondary;
  const entries = Object.entries(responses);
  if (entries.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name={{ sf: 'doc.text.fill', ion: 'document-text' }} size={16} color={theme.colors.inkText} />
        <Text style={styles.title}>Resumo de triagem</Text>
        {riskLevel && (
          <View style={[styles.riskBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.riskText, { color }]}>
              Risco {RISK_LABELS[riskLevel] ?? riskLevel}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.rows}>
        {entries.map(([key, value]) => (
          <View key={key} style={styles.row}>
            <Text style={styles.key}>{questionLabels?.[key] ?? key}:</Text>
            <Text style={styles.value}>{formatValue(value)}</Text>
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
  if (value === null || value === undefined) return '—';
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
  title: { fontSize: 14, fontWeight: '500', color: theme.colors.inkText, flex: 1 },
  riskBadge: {
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  riskText: { fontSize: 12, fontWeight: '500' },
  rows: { gap: 4 },
  row: { flexDirection: 'row', gap: theme.spacing.xs },
  key: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500', minWidth: 110 },
  value: { fontSize: 12, color: theme.colors.textPrimary, flex: 1 },
}));
