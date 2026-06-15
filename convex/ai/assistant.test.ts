/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
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
