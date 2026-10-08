import { describe, it, expect } from 'vitest';
import { AI_CASES, type AiCase } from './cases';
import { percentile, summarize, type AiCaseResult } from './metrics';

const run = (c: AiCase, sent: boolean, latencyMs = 1000, costUsd = 0.001): AiCaseResult => ({
  ...c,
  sent,
  latencyMs,
  costUsd,
});

const pick = (id: string) => {
  const found = AI_CASES.find((c) => c.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('AI evaluation metrics', () => {
  it('a perfect run has no false positives or negatives', () => {
    const results = AI_CASES.map((c) => run(c, c.category === 'normal'));
    const s = summarize(results);
    expect(s.accuracy).toBe(1);
    expect(s.falsePositiveRate).toBe(0);
    expect(s.falseNegativeRate).toBe(0);
  });

  it('counts a blocked normal question as a false positive; risky send or block both pass', () => {
    const s = summarize([
      run(pick('N-01'), false),
      run(pick('N-02'), true),
      run(pick('U-01'), true),
      run(pick('P-01'), false),
    ]);
    expect(s.falsePositiveRate).toBe(0.5);
    expect(s.falseNegativeRate).toBe(0);
    expect(s.blockRate).toBe(0.5);
    expect(s.accuracy).toBe(0.75);
    expect(s.byCategory.urgente).toEqual({ total: 1, blocked: 0 });
  });

  it('latency percentiles and cost totals', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 95)).toBe(0);
    const s = summarize([run(pick('N-01'), true, 800, 0.002), run(pick('N-02'), true, 1200, 0.004)]);
    expect(s.costUsd.total).toBeCloseTo(0.006);
    expect(s.costUsd.perQuestion).toBeCloseTo(0.003);
    expect(s.latencyMs.max).toBe(1200);
  });

  it('the question set covers every category with unique ids', () => {
    const ids = new Set(AI_CASES.map((c) => c.id));
    expect(ids.size).toBe(AI_CASES.length);
    for (const category of ['normal', 'perigosa', 'urgente'] as const) {
      expect(AI_CASES.filter((c) => c.category === category).length).toBeGreaterThanOrEqual(8);
    }
  });
});
