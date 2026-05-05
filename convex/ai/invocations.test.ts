/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { internal } from '../_generated/api';

// Vite resolves glob paths relative to the test file's own directory.
// Files co-located in convex/ai/ appear as './foo.ts' rather than '../ai/foo.ts'.
// convex-test derives its prefix from the _generated path ('../_generated/...'),
// giving prefix '../', and then looks up '../ai/invocations'.
// Fix: remap local './' keys to '../ai/' so they match the expected prefix.
function buildModules(): Record<string, () => Promise<unknown>> {
  const parent = import.meta.glob('../**/*.ts');
  const local = import.meta.glob('./**/*.ts');
  const result: Record<string, () => Promise<unknown>> = { ...parent };
  for (const [k, v] of Object.entries(local)) {
    const remapped = k.replace(/^\.\//, '../ai/');
    result[remapped] = v;
  }
  return result;
}

const modules = buildModules();

describe('aiInvocations', () => {
  it('createInvocation inserts a pending row', async () => {
    const t = convexTest(schema, modules);
    const { invocationId, configId, promptId, userId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {} as any);
      const configId = await ctx.db.insert('aiConfigs', {
        purpose: 'chat-summary',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6',
        apiKey: 'sk-test',
        createdBy: userId,
      });
      const promptId = await ctx.db.insert('aiPrompts', {
        purpose: 'chat-summary',
        systemPrompt: 'sum up',
        createdBy: userId,
      });
      return { configId, promptId, userId, invocationId: null as any };
    });
    const id = await t.mutation(internal.ai.invocations.createInvocation, {
      purpose: 'chat-summary',
      configId,
      promptId,
      userId,
    });
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.status).toBe('pending');
    expect(row?.purpose).toBe('chat-summary');
    expect(row?.userId).toBe(userId);
  });

  it('completeInvocation patches metrics on success', async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {} as any);
      const configId = await ctx.db.insert('aiConfigs', {
        purpose: 'chat-summary',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6',
        apiKey: 'sk-test',
        createdBy: userId,
      });
      const promptId = await ctx.db.insert('aiPrompts', {
        purpose: 'chat-summary',
        systemPrompt: 'sum up',
        createdBy: userId,
      });
      return ctx.db.insert('aiInvocations', {
        purpose: 'chat-summary',
        configId,
        promptId,
        status: 'pending',
      });
    });
    await t.mutation(internal.ai.invocations.completeInvocation, {
      invocationId: id,
      status: 'success',
      inputTokens: 100,
      outputTokens: 200,
      costUsd: 0.001,
      latencyMs: 1234,
    });
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.status).toBe('success');
    expect(row?.inputTokens).toBe(100);
    expect(row?.outputTokens).toBe(200);
    expect(row?.costUsd).toBeCloseTo(0.001);
    expect(row?.latencyMs).toBe(1234);
  });

  it('completeInvocation patches errorMessage on error', async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {} as any);
      const configId = await ctx.db.insert('aiConfigs', {
        purpose: 'chat-summary',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6',
        apiKey: 'sk-test',
        createdBy: userId,
      });
      const promptId = await ctx.db.insert('aiPrompts', {
        purpose: 'chat-summary',
        systemPrompt: 'sum up',
        createdBy: userId,
      });
      return ctx.db.insert('aiInvocations', {
        purpose: 'chat-summary',
        configId,
        promptId,
        status: 'pending',
      });
    });
    await t.mutation(internal.ai.invocations.completeInvocation, {
      invocationId: id,
      status: 'error',
      errorMessage: 'rate limited',
      latencyMs: 50,
    });
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.status).toBe('error');
    expect(row?.errorMessage).toBe('rate limited');
  });
});
