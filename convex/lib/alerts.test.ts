import { describe, it, expect } from 'vitest';
import { alertLevelFor, priorityFor, queueRank, sortQueue, showsAlert } from './alerts';
import { TRIAGE_SEEDS } from './seedData';

const questions = (topic: string) => TRIAGE_SEEDS.find((s) => s.topic === topic)!.questions;

describe('alertLevelFor', () => {
  it('is undefined when no risky answer was given', () => {
    expect(alertLevelFor(questions('pregnancy'), { weeks: 'Menos de 12 semanas', bleeding: 'no', 'abdominal-pain': 'no' })).toBeUndefined();
  });

  it("fires on 'yes' for yes/no questions", () => {
    expect(alertLevelFor(questions('sti'), { lesions: 'yes' })).toBe('priority');
    expect(alertLevelFor(questions('contraception'), { unprotected: 'yes' })).toBe('time-sensitive');
  });

  it('fires from the scale threshold (pain of 9 or more is urgent)', () => {
    expect(alertLevelFor(questions('menstrual-cycle'), { 'pain-intensity': 8 })).toBeUndefined();
    expect(alertLevelFor(questions('menstrual-cycle'), { 'pain-intensity': 9 })).toBe('urgent');
  });

  it('fires on the matching multiple-choice option', () => {
    expect(alertLevelFor(questions('contraception'), { 'main-concern': 'Eficácia do método' })).toBeUndefined();
    expect(alertLevelFor(questions('contraception'), { 'main-concern': 'Contraceção de emergência' })).toBe('time-sensitive');
  });

  it('keeps the most severe level when several answers are risky', () => {
    expect(
      alertLevelFor(questions('pregnancy'), { 'reduced-movement': 'yes', bleeding: 'yes', 'fluid-loss': 'yes' }),
    ).toBe('emergency');
    expect(alertLevelFor(questions('sti'), { lesions: 'yes', 'fever-pain': 'yes' })).toBe('urgent');
  });

  it('only emergency, urgent and time-sensitive show a message', () => {
    expect(showsAlert('emergency') && showsAlert('urgent') && showsAlert('time-sensitive')).toBe(true);
    expect(showsAlert('priority')).toBe(false);
  });
});

describe('priorityFor', () => {
  it('maps levels, then medium/low risk, to the stored priority', () => {
    expect(priorityFor('emergency', 'high')).toBe('urgent');
    expect(priorityFor('urgent', 'high')).toBe('urgent');
    expect(priorityFor('time-sensitive', 'high')).toBe('high');
    expect(priorityFor('priority', 'high')).toBe('high');
    expect(priorityFor(undefined, 'medium')).toBe('medium');
    expect(priorityFor(undefined, 'low')).toBe('low');
  });
});

describe('queue order', () => {
  const conv = (name: string, created: number, priority: string, alertLevel?: any) => ({
    name,
    _creationTime: created,
    priority,
    alertLevel,
  });

  it('emergency > urgent > time-sensitive > priority > medium risk > the rest', () => {
    const sorted = sortQueue([
      conv('low', 1, 'low'),
      conv('medium', 2, 'medium'),
      conv('priority', 3, 'high', 'priority'),
      conv('time', 4, 'high', 'time-sensitive'),
      conv('urgent', 5, 'urgent', 'urgent'),
      conv('emergency', 6, 'urgent', 'emergency'),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(['emergency', 'urgent', 'time', 'priority', 'medium', 'low']);
  });

  it('puts the oldest first within the same level', () => {
    const sorted = sortQueue([conv('newer', 20, 'urgent', 'urgent'), conv('older', 10, 'urgent', 'urgent')]);
    expect(sorted.map((c) => c.name)).toEqual(['older', 'newer']);
  });

  it('ranks conversations without a level by their priority (e.g. marked urgent by hand)', () => {
    expect(queueRank({ priority: 'urgent' })).toBe(queueRank({ priority: 'urgent', alertLevel: 'urgent' }));
    expect(queueRank({ priority: 'high' })).toBe(queueRank({ priority: 'high', alertLevel: 'priority' }));
    expect(queueRank({ priority: 'urgent', alertLevel: 'emergency' })).toBeGreaterThan(queueRank({ priority: 'urgent' }));
  });
});
