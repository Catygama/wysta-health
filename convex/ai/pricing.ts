import type { AiProvider } from './types';

export type ModelPricing = {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
};

// Hardcoded pricing snapshot — update via PR when providers change rates.
const PRICING: Partial<Record<AiProvider, Record<string, ModelPricing>>> = {
  anthropic: {
    'claude-opus-4-7': { inputUsdPer1k: 0.015, outputUsdPer1k: 0.075 },
    'claude-sonnet-4-6': { inputUsdPer1k: 0.003, outputUsdPer1k: 0.015 },
    'claude-haiku-4-5-20251001': { inputUsdPer1k: 0.0008, outputUsdPer1k: 0.004 },
  },
  openai: {
    'gpt-4o': { inputUsdPer1k: 0.0025, outputUsdPer1k: 0.01 },
    'gpt-4o-mini': { inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
    'gpt-4.1': { inputUsdPer1k: 0.002, outputUsdPer1k: 0.008 },
    'gpt-4.1-mini': { inputUsdPer1k: 0.0004, outputUsdPer1k: 0.0016 },
  },
};

export function getPricing(provider: AiProvider, modelId: string): ModelPricing | undefined {
  return PRICING[provider]?.[modelId];
}

export function computeCostUsd(
  provider: AiProvider,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number | undefined {
  const p = getPricing(provider, modelId);
  if (!p) return undefined;
  return (inputTokens / 1000) * p.inputUsdPer1k + (outputTokens / 1000) * p.outputUsdPer1k;
}
