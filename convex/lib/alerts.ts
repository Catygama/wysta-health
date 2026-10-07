// Triage alert levels: what a risky answer triggers. Shared by the server
// (conversations.create stores the level and orders the queue) and the app
// (app/triage.tsx shows the alert), so both compute it the same way.
// Alert copy lives in constants/triageAlerts.ts.
import { v } from 'convex/values';

export const ALERT_LEVELS = ['emergency', 'urgent', 'time-sensitive', 'priority'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const alertLevelValidator = v.union(
  v.literal('emergency'),
  v.literal('urgent'),
  v.literal('time-sensitive'),
  v.literal('priority'),
);

// How an answer triggers a question's alert: 'yes' on yes/no questions,
// `minScale` or more on scale questions, one of `equals` on multiple choice.
export type QuestionAlert = {
  level: AlertLevel;
  minScale?: number;
  equals?: string[];
};

type AlertQuestion = { id: string; type: string; alert?: QuestionAlert };
type Answer = string | number | boolean | undefined | null;

// Higher is more severe.
const SEVERITY: Record<AlertLevel, number> = {
  emergency: 4,
  urgent: 3,
  'time-sensitive': 2,
  priority: 1,
};

// Emergency, urgent and time-sensitive show a message during triage;
// priority only raises the conversation in the queue.
export function showsAlert(level: AlertLevel): boolean {
  return level !== 'priority';
}

export function isAlertAnswer(alert: QuestionAlert, answer: Answer): boolean {
  if (answer === undefined || answer === null || answer === '') return false;
  if (alert.minScale !== undefined) return typeof answer === 'number' && answer >= alert.minScale;
  if (alert.equals) return alert.equals.includes(String(answer));
  return answer === 'yes' || answer === true;
}

export function moreSevere(a: AlertLevel | undefined, b: AlertLevel | undefined) {
  if (!a) return b;
  if (!b) return a;
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

// The most severe level among the answered questions, or undefined.
export function alertLevelFor(
  questions: AlertQuestion[],
  responses: Record<string, Answer>,
): AlertLevel | undefined {
  let level: AlertLevel | undefined;
  for (const q of questions) {
    if (q.alert && isAlertAnswer(q.alert, responses[q.id])) level = moreSevere(level, q.alert.level);
  }
  return level;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// Stored priority for a new conversation: emergency/urgent are 'urgent',
// time-sensitive/priority are 'high', otherwise the medium/low risk rules.
export function priorityFor(level: AlertLevel | undefined, risk: 'low' | 'medium' | 'high'): Priority {
  if (level === 'emergency' || level === 'urgent') return 'urgent';
  if (level) return 'high';
  if (risk === 'high') return 'high';
  if (risk === 'medium') return 'medium';
  return 'low';
}

// Queue order: emergency > urgent > time-sensitive > priority > medium risk >
// the rest. Conversations without a triage level (older ones, or a priority a
// professional changed by hand) rank by their priority: urgent with urgent,
// high with priority.
const QUEUE_RANK: Record<AlertLevel, number> = {
  emergency: 6,
  urgent: 5,
  'time-sensitive': 4,
  priority: 3,
};
const PRIORITY_QUEUE_RANK: Record<string, number> = { urgent: 5, high: 3, medium: 2, low: 1 };

export function queueRank(c: { alertLevel?: AlertLevel; priority: string }): number {
  const fromLevel = c.alertLevel ? QUEUE_RANK[c.alertLevel] : 0;
  return Math.max(fromLevel, PRIORITY_QUEUE_RANK[c.priority] ?? 0);
}

// Most severe first; within a rank, the one waiting longest (oldest) first.
export function sortQueue<T extends { alertLevel?: AlertLevel; priority: string; _creationTime: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => queueRank(b) - queueRank(a) || a._creationTime - b._creationTime);
}
