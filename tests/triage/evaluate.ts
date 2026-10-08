import { alertLevelFor, isAlertAnswer, priorityFor } from '@/convex/lib/alerts';
import { calculateRiskLevel } from '@/convex/lib/risk';
import { TRIAGE_SEEDS } from '@/convex/lib/seedData';
import { resolveAlert } from '@/constants/triageAlerts';
import type { Call, TriageCase } from './cases';

function callName(tel: string | undefined, a11yLabel: string | undefined): Call {
  if (!tel) return null;
  if (tel === 'tel:112') return '112';
  return a11yLabel?.includes('Grávida') ? 'SNS Grávida' : 'SNS 24';
}

// Same functions the server (conversations.create) and the app (app/triage.tsx)
// use, so this is what a patient answering `responses` gets.
export function evaluateCase({ topic, responses }: TriageCase) {
  const seed = TRIAGE_SEEDS.find((s) => s.topic === topic);
  if (!seed) throw new Error(`No triage for ${topic}`);
  const { questions, riskAssessment } = seed;
  const level = alertLevelFor(questions, responses) ?? null;
  const risk = calculateRiskLevel(responses, riskAssessment);
  const priority = priorityFor(level ?? undefined, risk);
  const trigger = level
    ? questions.find((q) => q.alert?.level === level && isAlertAnswer(q.alert, responses[q.id]))
    : undefined;
  const alert = level && trigger ? resolveAlert(topic, trigger.id, level) : null;
  return {
    level,
    risk,
    priority,
    call: callName(alert?.call?.tel, alert?.call?.a11yLabel),
    message: alert?.message ?? null,
  };
}
