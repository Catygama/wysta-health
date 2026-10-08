import { View } from 'react-native';
import { AuthorLabel } from '@/components/chat/ChatMessage';
import { UrgencyCard } from '@/screens/UrgencyAlert';
import { ALERT_LABELS } from '@/constants/triageAlerts';
import { SAFETY_RULES, type SafetyRuleId } from '@/convex/lib/aiSafetyMessages';

// Fixed message of a safety rule (convex/lib/aiSafetyMessages) in a chat with
// a nurse or with the AI: the triage alert's card for the rule's level, with
// the contacts as call buttons.
export function SafetyRuleMessage({ ruleId, content }: { ruleId: SafetyRuleId; content: string }) {
  const rule = SAFETY_RULES.find((r) => r.id === ruleId);
  if (!rule) return null;
  return (
    <View testID="safety-rule-message">
      <AuthorLabel>Mensagem automática da Wysta</AuthorLabel>
      <UrgencyCard
        inline
        title={ALERT_LABELS[rule.alertLevel]}
        message={content}
        calls={rule.calls.map((call) => ({ ...call, testID: `safety-rule-call-${call.tel.slice(4)}` }))}
      />
    </View>
  );
}
