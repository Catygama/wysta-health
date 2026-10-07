// Triage alert copy: the only place to edit what each alert level says.
// Levels and which answers trigger them live in convex/lib/seedData.ts
// (`alert` on each question); the logic is in convex/lib/alerts.ts.
import type { AlertLevel } from '@/convex/lib/alerts';
import type { TopicId } from '@/constants/topics';

export const ALERT_LABELS: Record<AlertLevel, string> = {
  emergency: 'Emergência',
  urgent: 'Urgente',
  'time-sensitive': 'Sensível ao tempo',
  priority: 'Prioritário',
};

// Default message per level. Priority shows no message to the patient.
const LEVEL_MESSAGES: Record<Exclude<AlertLevel, 'priority'>, string> = {
  emergency: 'Isto pode ser uma emergência. Liga já para o 112.',
  urgent: 'Esta situação precisa de avaliação rápida. Liga para o SNS 24 (808 24 24 24).',
  'time-sensitive':
    'Se tiveste relações sem proteção, a contraceção de emergência está disponível na farmácia e é mais eficaz quanto mais cedo for tomada (até 72 a 120 horas, consoante o método). A tua mensagem segue também para a equipa de enfermagem.',
};

// Per-topic overrides of the level message.
const TOPIC_MESSAGES: Partial<Record<TopicId, Partial<Record<AlertLevel, string>>>> = {
  pregnancy: {
    urgent: 'Esta situação precisa de avaliação rápida. Liga para a linha SNS Grávida (808 24 24 24).',
  },
};

// Per-question overrides ("topic/questionId"), most specific wins.
const QUESTION_MESSAGES: Record<string, string> = {
  'pregnancy/reduced-movement':
    'Uma mudança nos movimentos do bebé deve ser avaliada sem demora. Liga já para o SNS 24 (808 24 24 24) e não esperes pelo dia seguinte.',
};

export type AlertCall = { label: string; a11yLabel: string; tel: string };

const CALL_112: AlertCall = { label: 'Ligar 112', a11yLabel: 'Ligar para o 112', tel: 'tel:112' };
const CALL_SNS24: AlertCall = {
  // The line's name is in the message; the button stays on one line.
  label: 'Ligar 808 24 24 24',
  a11yLabel: 'Ligar para o SNS 24, 808 24 24 24',
  tel: 'tel:808242424',
};
const CALL_SNS_GRAVIDA: AlertCall = {
  label: 'Ligar 808 24 24 24',
  a11yLabel: 'Ligar para a linha SNS Grávida, 808 24 24 24',
  tel: 'tel:808242424',
};

export type ResolvedAlert = {
  level: AlertLevel;
  label: string;
  message: string;
  call: AlertCall | null;
  // Urgent alerts also offer 112, for when it turns out to be an emergency.
  fallback112: boolean;
};

export function resolveAlert(topic: TopicId, questionId: string, level: AlertLevel): ResolvedAlert | null {
  if (level === 'priority') return null;
  const message =
    QUESTION_MESSAGES[`${topic}/${questionId}`] ?? TOPIC_MESSAGES[topic]?.[level] ?? LEVEL_MESSAGES[level];
  const reducedMovement = topic === 'pregnancy' && questionId === 'reduced-movement';
  let call: AlertCall | null = null;
  if (level === 'emergency') call = CALL_112;
  else if (level === 'urgent') call = topic === 'pregnancy' && !reducedMovement ? CALL_SNS_GRAVIDA : CALL_SNS24;
  return { level, label: ALERT_LABELS[level], message, call, fallback112: level === 'urgent' };
}
