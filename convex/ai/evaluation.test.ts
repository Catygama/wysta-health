/// <reference types="vite/client" />
import { vi } from 'vitest';
vi.mock('./llm', () => ({
  callLlmText: vi.fn(),
  callLlmObject: vi.fn(),
  callLlmStream: vi.fn(),
}));
import { callLlmText, callLlmObject } from './llm';
import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

function buildModules(): Record<string, () => Promise<unknown>> {
  const parent = import.meta.glob('../**/*.ts');
  const local = import.meta.glob('./**/*.ts');
  const result: Record<string, () => Promise<unknown>> = { ...parent };
  for (const [k, v] of Object.entries(local)) {
    result[k.replace(/^\.\//, '../ai/')] = v;
  }
  return result;
}
const modules = buildModules();

async function seedChain(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    const adminId = (await ctx.db.insert('users', {})) as Id<'users'>;
    for (const purpose of ['chat', 'chat-validator-safety', 'chat-validator-clinical', 'chat-judge'] as const) {
      await ctx.db.insert('aiConfigs', {
        purpose,
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: 'sk-test',
        createdBy: adminId,
      });
      await ctx.db.insert('aiPrompts', {
        purpose,
        systemPrompt: 'x',
        userTemplate: '{{query}}',
        createdBy: adminId,
      });
    }
  });
}

describe('ai.evaluation.runCase', () => {
  beforeEach(() => {
    vi.mocked(callLlmText).mockReset();
    vi.mocked(callLlmObject).mockReset();
  });

  it('reports the decision, every call of the chain and its cost, without writing messages', async () => {
    const t = convexTest(schema, modules);
    await seedChain(t);
    vi.mocked(callLlmText).mockResolvedValue({ output: 'Um ciclo dura 21 a 35 dias.', inputTokens: 1000, outputTokens: 200 });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 500, outputTokens: 20 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 500, outputTokens: 20 })
      .mockResolvedValueOnce({ output: { action: 'send', finalAnswer: 'x' }, inputTokens: 600, outputTokens: 30 });

    const res = await t.action(internal.ai.evaluation.runCase, {
      query: 'Quantos dias dura um ciclo?',
      topic: 'menstrual-cycle',
    });

    expect(res).toMatchObject({ sent: true, safety: 'approve', clinical: 'approve', calls: 4 });
    expect(res.costUsd).toBeGreaterThan(0);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    const messages = await t.run((ctx) => ctx.db.query('messages').take(1));
    expect(messages).toEqual([]);
  });

  it('a validator block surfaces as not sent', async () => {
    const t = convexTest(schema, modules);
    await seedChain(t);
    vi.mocked(callLlmText).mockResolvedValue({ output: 'rascunho', inputTokens: 1, outputTokens: 1 });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'block', reason: 'dosagem' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'block', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 });

    const res = await t.action(internal.ai.evaluation.runCase, { query: 'Que dose de misoprostol?' });
    expect(res).toMatchObject({ sent: false, safety: 'block' });
  });
});
