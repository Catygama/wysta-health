import { View, Text } from 'react-native';
import { spacing, typography, radius } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { RISK_LABELS } from '@/constants/conversation';
import { useTheme } from '@/lib/theme';

const RISK_COLORS: Record<string, string> = {
  high: '#DC2626',
  medium: '#D97706',
  low: '#059669',
};

type Props = {
  riskLevel?: string;
  responses: Record<string, unknown>;
  questionLabels?: Record<string, string>;
};

export function TriageSummary({ riskLevel, responses, questionLabels }: Props) {
  const { colors } = useTheme();
  const color = RISK_COLORS[riskLevel ?? 'low'] ?? colors.text.secondary;
  const entries = Object.entries(responses);
  if (entries.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.primaryLight,
        borderWidth: 1,
        borderColor: colors.primary + '40',
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Icon
          name={{ sf: 'doc.text.fill', ion: 'document-text' }}
          size={16}
          color={colors.primary}
        />
        <Text
          style={{
            ...typography.sm,
            fontWeight: '700',
            color: colors.primary,
            flex: 1,
          }}
        >
          Resumo de triagem
        </Text>
        {riskLevel && (
          <View
            style={{
              backgroundColor: color + '20',
              paddingVertical: 2,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.full,
            }}
          >
            <Text
              style={{
                ...typography.xs,
                fontWeight: '700',
                color,
              }}
            >
              Risco {RISK_LABELS[riskLevel] ?? riskLevel}
            </Text>
          </View>
        )}
      </View>
      <View style={{ gap: 4 }}>
        {entries.map(([key, value]) => (
          <View key={key} style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Text
              style={{
                ...typography.xs,
                color: colors.text.secondary,
                fontWeight: '600',
                minWidth: 110,
              }}
            >
              {questionLabels?.[key] ?? key}:
            </Text>
            <Text
              style={{
                ...typography.xs,
                color: colors.text.primary,
                flex: 1,
              }}
            >
              {formatValue(value)}
            </Text>
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
