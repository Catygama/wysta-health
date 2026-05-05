/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { internal } from '../_generated/api';

vi.mock('./llm', () => ({
  callLlmText: vi.fn(),
  callLlmObject: vi.fn(),
}));
import { callLlmText, callLlmObject } from './llm';
import { runAgent } from './runAgent';

// Vite resolves glob paths relative to the test file's own directory.
// Files co-located in convex/ai/ appear as './foo.ts' rather than '../ai/foo.ts'.
// convex-test derives its prefix from the _generated path ('../_generated/...'),
// giving prefix '../', and then looks up '../ai/runAgent'.
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

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {} as any) as Id<'users'>;
    const configId = await ctx.db.insert('aiConfigs', {
      purpose: 'chat-summary',
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      apiKey: 'sk-test',
      createdBy: userId,
    });
    const promptId = await ctx.db.insert('aiPrompts', {
      purpose: 'chat-summary',
      systemPrompt: 'Summarise the conversation.',
      userTemplate: 'Conversa:\n{{conversationText}}',
      temperature: 0.3,
      maxTokens: 800,
      createdBy: userId,
    });
    return { userId, configId, promptId };
  });
}

beforeEach(() => {
  vi.mocked(callLlmText).mockReset();
  vi.mocked(callLlmObject).mockReset();
});

describe('runAgent', () => {
  it('happy path: writes pending then success invocation, returns output', async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    vi.mocked(callLlmText).mockResolvedValue({
      output: 'short summary',
      inputTokens: 120,
      outputTokens: 30,
    });

    const result = await t.run(async (ctx) =>
      runAgent(ctx, {
        purpose: 'chat-summary',
        vars: { conversationText: 'hello world' },
        userId,
      })
    );

    expect(result.output).toBe('short summary');
    expect(callLlmText).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(callLlmText).mock.calls[0][0];
    expect(callArgs.userPrompt).toBe('Conversa:\nhello world');
    expect(callArgs.systemPrompt).toBe('Summarise the conversation.');
    expect(callArgs.modelId).toBe('claude-sonnet-4-6');

    const row = await t.run(async (ctx) => ctx.db.get(result.invocationId));
    expect(row?.status).toBe('success');
    expect(row?.inputTokens).toBe(120);
    expect(row?.outputTokens).toBe(30);
    expect(row?.costUsd).toBeGreaterThan(0);
    expect(row?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('error path: writes error invocation and rethrows', async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    vi.mocked(callLlmText).mockRejectedValue(new Error('rate limited'));

    // Use the registered action so each ctx.runMutation is an independently
    // committed transaction — error status is persisted even when the action throws.
    await expect(
      t.action(internal.ai.runAgent.run, {
        purpose: 'chat-summary',
        vars: { conversationText: 'hello' },
      })
    ).rejects.toThrow(/rate limited/);

    const row = await t.run(async (ctx) =>
      ctx.db.query('aiInvocations').order('desc').first()
    );
    expect(row?.status).toBe('error');
    expect(row?.errorMessage).toContain('rate limited');
  });

  it('persists parentInvocationId for chain audit', async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    vi.mocked(callLlmText).mockResolvedValue({
      output: 'first',
      inputTokens: 10,
      outputTokens: 5,
    });
    const first = await t.run(async (ctx) =>
      runAgent(ctx, {
        purpose: 'chat-summary',
        vars: { conversationText: 'a' },
      })
    );
    vi.mocked(callLlmText).mockResolvedValue({
      output: 'second',
      inputTokens: 10,
      outputTokens: 5,
    });
    const second = await t.run(async (ctx) =>
      runAgent(ctx, {
        purpose: 'chat-summary',
        vars: { conversationText: 'b' },
        parentInvocationId: first.invocationId,
      })
    );
    const row = await t.run(async (ctx) => ctx.db.get(second.invocationId));
    expect(row?.parentInvocationId).toBe(first.invocationId);
  });

  it('uses callLlmObject when outputSchema provided', async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const { z } = await import('zod');
    const schemaShape = z.object({ summary: z.string() });
    vi.mocked(callLlmObject).mockResolvedValue({
      output: { summary: 'ok' },
      inputTokens: 50,
      outputTokens: 10,
    });
    const result = await t.run(async (ctx) =>
      runAgent(ctx, {
        purpose: 'chat-summary',
        vars: { conversationText: 'x' },
        outputSchema: schemaShape,
      })
    );
    expect(result.output).toEqual({ summary: 'ok' });
    expect(callLlmObject).toHaveBeenCalledTimes(1);
    expect(callLlmText).not.toHaveBeenCalled();
  });

  it('throws clearly when template variable missing', async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    await expect(
      t.run(async (ctx) =>
        runAgent(ctx, {
          purpose: 'chat-summary',
          vars: {}, // missing conversationText
        })
      )
    ).rejects.toThrow(/missing variable: conversationText/i);
    const row = await t.run(async (ctx) =>
      ctx.db.query('aiInvocations').first()
    );
    expect(row).toBeNull();
  });
});
