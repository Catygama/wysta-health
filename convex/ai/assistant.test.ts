/// <reference types="vite/client" />
import { vi } from 'vitest';
vi.mock('./llm', () => ({
  callLlmText: vi.fn(),
  callLlmObject: vi.fn(),
  callLlmStream: vi.fn(),
}));
import { callLlmStream, callLlmObject } from './llm';
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

async function seedChatChain(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const conversationId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: 'sexual-wellbeing',
      status: 'active',
      priority: 'low',
      title: 'test',
      lastMessageAt: 0,
      kind: 'ai-only',
    } as any);
    for (const purpose of [
      'chat',
      'chat-validator-safety',
      'chat-validator-clinical',
      'chat-judge',
    ] as const) {
      await ctx.db.insert('aiConfigs', {
        purpose,
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: 'sk-test',
        createdBy: userId,
      });
      await ctx.db.insert('aiPrompts', {
        purpose,
        systemPrompt: 'x',
        userTemplate: '{{query}}',
        createdBy: userId,
      });
    }
    return { userId, conversationId };
  });
}

async function aiMessage(t: ReturnType<typeof convexTest>, conversationId: Id<'conversations'>) {
  return t.run(async (ctx) => {
    const msgs = await (ctx.db as any)
      .query('messages')
      .withIndex('by_conversation', (q: any) => q.eq('conversationId', conversationId))
      .collect();
    return (msgs as any[]).find((m: any) => m.messageType === 'ai-response') ?? null;
  });
}

describe('assistant streaming (respondAuto)', () => {
  beforeEach(() => {
    vi.mocked(callLlmStream).mockReset();
    vi.mocked(callLlmObject).mockReset();
  });

  it('approved: streams draft then finalizes with disclaimer', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmStream).mockImplementation(async (a: any) => {
      await a.onDelta?.('Olá');
      await a.onDelta?.('Olá, aqui vai');
      return { output: 'Olá, aqui vai', inputTokens: 10, outputTokens: 5 };
    });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'send', finalAnswer: 'Olá, aqui vai' }, inputTokens: 1, outputTokens: 1 });

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).toContain('Olá, aqui vai');
    expect(msg?.content).toContain('não substitui consulta');
    expect(msg?.streaming).toBe(false);
    expect(vi.mocked(callLlmStream).mock.calls[0][0].onDelta).toBeTypeOf('function');
  });

  it('blocked: finalizes with the fixed forwarding message', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmStream).mockImplementation(async (a: any) => {
      await a.onDelta?.('rascunho perigoso');
      return { output: 'rascunho perigoso', inputTokens: 10, outputTokens: 5 };
    });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'block', reason: 'unsafe' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'block', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 });

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).toContain('Falar com profissional');
    expect(msg?.content).not.toContain('rascunho perigoso');
    expect(msg?.streaming).toBe(false);
  });

  it('error: finalizes with a fallback message', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmStream).mockRejectedValue(new Error('boom'));

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.streaming).toBe(false);
    expect(msg?.content).toContain('Não consegui responder');
  });
});

describe('assistant.gatherContext', () => {
  it('returns the conversation topic', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await t.run(async (ctx) => {
      const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const conversationId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'sexual-wellbeing',
        status: 'active',
        priority: 'low',
        title: 'test',
        lastMessageAt: 0,
      } as any);
      return { userId, conversationId };
    });
    const res = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.assistant.gatherContext, { conversationId, userId })
    );
    expect(res.allowed).toBe(true);
    expect((res as any).topic).toBe('sexual-wellbeing');
  });

  it('includes the wellbeing goal in topicAndRisk', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await t.run(async (ctx) => {
      const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const conversationId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'sexual-wellbeing',
        status: 'active',
        priority: 'low',
        title: 'test',
        lastMessageAt: 0,
        wellbeingGoal: 'Reacender o desejo',
      } as any);
      return { userId, conversationId };
    });
    const res = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.assistant.gatherContext, { conversationId, userId })
    );
    expect((res as any).topicAndRisk).toContain('Reacender o desejo');
  });
});
