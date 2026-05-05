import { describe, it, expect } from 'vitest';
import { computeCostUsd, getPricing } from './pricing';

describe('pricing', () => {
  it('returns price for known anthropic model', () => {
    const p = getPricing('anthropic', 'claude-sonnet-4-6');
    expect(p).toBeDefined();
    expect(p!.inputUsdPer1k).toBeGreaterThan(0);
    expect(p!.outputUsdPer1k).toBeGreaterThan(0);
  });

  it('returns undefined for unknown combo', () => {
    expect(getPricing('anthropic', 'no-such-model')).toBeUndefined();
  });

  it('computes cost from token counts', () => {
    // 1000 input tokens at $0.003/1k + 500 output tokens at $0.015/1k = $0.0105
    const cost = computeCostUsd('anthropic', 'claude-sonnet-4-6', 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 8);
  });

  it('returns undefined cost for unknown model', () => {
    expect(computeCostUsd('anthropic', 'no-such-model', 1000, 500)).toBeUndefined();
  });
});
