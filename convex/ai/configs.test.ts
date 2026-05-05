/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { api, internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// Vite resolves glob paths relative to the test file's own directory.
// Files co-located in convex/ai/ appear as './foo.ts' rather than '../ai/foo.ts'.
// convex-test derives its prefix from the _generated path ('../_generated/...'),
// giving prefix '../', and then looks up '../ai/configs'.
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
  // Insert a real users row so getAuthUserId can resolve it.
  const userId = await t.run(async (ctx) => {
    return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
  });
  // Create identity whose subject IS the users._id.
  const asAdmin = t.withIdentity({ subject: userId as string });
  await asAdmin.run(async (ctx) => {
    await ctx.db.insert('userProfiles', { userId, role: 'admin' });
  });
  return asAdmin;
}

describe('aiConfigs', () => {
  it('insertConfig rejects non-admin', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    const asUser = t.withIdentity({ subject: userId as string });
    await asUser.run(async (ctx) => {
      await ctx.db.insert('userProfiles', { userId, role: 'patient' });
    });
    await expect(
      asUser.mutation(api.ai.configs.insertConfig, {
        purpose: 'chat-summary',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6',
        apiKey: 'sk-test',
      })
    ).rejects.toThrow(/admin/i);
  });

  it('insertConfig persists; getActiveConfig returns latest', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.configs.insertConfig, {
      purpose: 'chat-summary',
      provider: 'anthropic',
      modelId: 'claude-haiku-4-5-20251001',
      apiKey: 'sk-old',
    });
    await asAdmin.mutation(api.ai.configs.insertConfig, {
      purpose: 'chat-summary',
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      apiKey: 'sk-new',
    });
    const active = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.configs.getActiveConfig, { purpose: 'chat-summary' })
    );
    expect(active.modelId).toBe('claude-sonnet-4-6');
    expect(active.apiKey).toBe('sk-new');
  });

  it('getActiveConfig throws when none for purpose', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.run(async (ctx) =>
        ctx.runQuery(internal.ai.configs.getActiveConfig, { purpose: 'chat-summary' })
      )
    ).rejects.toThrow(/no aiConfigs/i);
  });

  it('listConfigsMasked masks apiKey to last4', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.configs.insertConfig, {
      purpose: 'chat-summary',
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      apiKey: 'sk-abcdef-1234',
    });
    const rows = await asAdmin.query(api.ai.configs.listConfigsMasked, {});
    expect(rows[0].apiKey).toBe('sk-…1234');
  });

  it('listConfigsMasked rejects non-admin', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    const asUser = t.withIdentity({ subject: userId as string });
    await asUser.run(async (ctx) => {
      await ctx.db.insert('userProfiles', { userId, role: 'patient' });
    });
    await expect(asUser.query(api.ai.configs.listConfigsMasked, {})).rejects.toThrow(/admin/i);
  });
});
