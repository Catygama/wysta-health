/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { api, internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// Vite resolves glob paths relative to the test file's own directory.
// Files co-located in convex/ai/ appear as './foo.ts' rather than '../ai/foo.ts'.
// convex-test derives its prefix from the _generated path ('../_generated/...'),
// giving prefix '../', and then looks up '../ai/prompts'.
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

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
  });
  const asAdmin = t.withIdentity({ subject: userId as string });
  await asAdmin.run(async (ctx) => {
    await ctx.db.insert('userProfiles', { userId, role: 'admin' });
  });
  return asAdmin;
}

describe('aiPrompts', () => {
  it('insertPrompt rejects non-admin', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    const asUser = t.withIdentity({ subject: userId as string });
    await asUser.run(async (ctx) => {
      await ctx.db.insert('userProfiles', { userId, role: 'patient' });
    });
    await expect(
      asUser.mutation(api.ai.prompts.insertPrompt, {
        purpose: 'chat-summary',
        systemPrompt: 'sum up',
      })
    ).rejects.toThrow(/admin/i);
  });

  it('getActivePrompt returns latest', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat-summary',
      systemPrompt: 'old prompt',
    });
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat-summary',
      systemPrompt: 'new prompt',
      temperature: 0.4,
      maxTokens: 800,
    });
    const active = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, { purpose: 'chat-summary' })
    );
    expect(active.systemPrompt).toBe('new prompt');
    expect(active.temperature).toBe(0.4);
    expect(active.maxTokens).toBe(800);
  });

  it('getActivePrompt throws when none', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.run(async (ctx) =>
        ctx.runQuery(internal.ai.prompts.getActivePrompt, { purpose: 'chat-summary' })
      )
    ).rejects.toThrow(/no aiPrompts/i);
  });

  it('getActivePrompt returns the topic variant when one exists', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat',
      systemPrompt: 'global draft',
    });
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat',
      systemPrompt: 'wellbeing draft',
      topic: 'sexual-wellbeing',
    });
    const variant = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, {
        purpose: 'chat',
        topic: 'sexual-wellbeing',
      })
    );
    expect(variant.systemPrompt).toBe('wellbeing draft');
  });

  it('getActivePrompt falls back to global when no variant for the topic', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat',
      systemPrompt: 'global draft',
    });
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat',
      systemPrompt: 'wellbeing draft',
      topic: 'sexual-wellbeing',
    });
    const general = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, {
        purpose: 'chat',
        topic: 'general',
      })
    );
    expect(general.systemPrompt).toBe('global draft');
  });

  it('getActivePrompt without topic ignores topic variants (returns global)', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat',
      systemPrompt: 'global draft',
    });
    await asAdmin.mutation(api.ai.prompts.insertPrompt, {
      purpose: 'chat',
      systemPrompt: 'wellbeing draft',
      topic: 'sexual-wellbeing',
    });
    const active = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, { purpose: 'chat' })
    );
    expect(active.systemPrompt).toBe('global draft');
  });
});
