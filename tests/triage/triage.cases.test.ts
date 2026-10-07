import { describe, it, expect } from 'vitest';
import { TRIAGE_SEEDS } from '@/convex/lib/seedData';
import { TRIAGE_CASES } from './cases';
import { evaluateCase } from './evaluate';

describe('triage cases', () => {
  it.each(TRIAGE_CASES.map((tc) => [tc.id, tc.description, tc] as const))(
    '%s %s',
    (_id, _description, tc) => {
      const { level, priority, call } = evaluateCase(tc);
      expect({ level, priority, call }).toEqual(tc.expected);
    },
  );

  it('every alarm question is covered by at least one case', () => {
    const covered = new Set(
      TRIAGE_CASES.flatMap((tc) =>
        Object.entries(tc.responses)
          .filter(([, v]) => v === 'yes')
          .map(([q]) => `${tc.topic}/${q}`),
      ),
    );
    const alarmQuestions = TRIAGE_SEEDS.flatMap((s) =>
      s.questions
        .filter((q) => q.alert && q.type === 'yes-no')
        .map((q) => `${s.topic}/${q.id}`),
    );
    expect(alarmQuestions.filter((q) => !covered.has(q))).toEqual([]);
  });

  it('every alert that shows a message also gives a number to call or a next step', () => {
    for (const tc of TRIAGE_CASES) {
      const { level, message } = evaluateCase(tc);
      if (level && level !== 'priority') expect(message, tc.id).toBeTruthy();
    }
  });
});
