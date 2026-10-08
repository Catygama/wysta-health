/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { api, internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// See configs.test.ts for why local './' glob keys are remapped to '../ai/'.
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

async function seedPatient(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
  });
  const asUser = t.withIdentity({ subject: userId as string });
  await asUser.run(async (ctx) => {
    await ctx.db.insert('userProfiles', { userId, role: 'patient' });
  });
  return asUser;
}

describe('ai.admin.overview', () => {
  it('rejects non-admin', async () => {
    const t = convexTest(schema, modules);
    const asUser = await seedPatient(t);
    await expect(asUser.query(api.ai.admin.overview, {})).rejects.toThrow(/admin/i);
  });

  it('returns every purpose with metadata and null when unconfigured', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    const ov = await asAdmin.query(api.ai.admin.overview, {});
    expect(ov.purposes.length).toBe(6);
    const summary = ov.purposes.find((p) => p.purpose === 'chat-summary');
    expect(summary?.meta.label).toBeTruthy();
    expect(summary?.meta.variables).toContain('conversationText');
    expect(summary?.config).toBeNull();
    expect(summary?.prompt).toBeNull();
    expect(ov.providers).toContain('openai');
    expect(ov.wiredProviders).toContain('openai');
  });

  it('masks the key in overview but exposes provider/model', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.saveConfig, {
      purpose: 'chat',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      apiKey: 'sk-secret-9999',
    });
    const ov = await asAdmin.query(api.ai.admin.overview, {});
    const chat = ov.purposes.find((p) => p.purpose === 'chat');
    expect(chat?.config?.modelId).toBe('gpt-4o-mini');
    expect(chat?.config?.apiKeyMasked).toBe('sk-…9999');
    expect(JSON.stringify(ov)).not.toContain('sk-secret-9999');
  });
});

describe('ai.admin.saveConfig', () => {
  it('carries the key forward when apiKey is omitted', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.saveConfig, {
      purpose: 'chat',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      apiKey: 'sk-keep-1234',
    });
    // Change only the model — no key supplied.
    await asAdmin.mutation(api.ai.admin.saveConfig, {
      purpose: 'chat',
      provider: 'openai',
      modelId: 'gpt-4o',
    });
    const active = await t.run((ctx) =>
      ctx.runQuery(internal.ai.configs.getActiveConfig, { purpose: 'chat' })
    );
    expect(active.modelId).toBe('gpt-4o');
    expect(active.apiKey).toBe('sk-keep-1234');
  });

  it('throws when no prior key exists and none supplied', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await expect(
      asAdmin.mutation(api.ai.admin.saveConfig, {
        purpose: 'chat',
        provider: 'openai',
        modelId: 'gpt-4o-mini',
      })
    ).rejects.toThrow(/chave anterior/i);
  });

  it('rejects non-admin', async () => {
    const t = convexTest(schema, modules);
    const asUser = await seedPatient(t);
    await expect(
      asUser.mutation(api.ai.admin.saveConfig, {
        purpose: 'chat',
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: 'sk-x',
      })
    ).rejects.toThrow(/admin/i);
  });
});

describe('ai.admin.revealKey', () => {
  it('returns the full plaintext key for admin', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.saveConfig, {
      purpose: 'chat',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      apiKey: 'sk-reveal-me-5678',
    });
    const key = await asAdmin.query(api.ai.admin.revealKey, { purpose: 'chat' });
    expect(key).toBe('sk-reveal-me-5678');
  });

  it('returns null when no config', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    const key = await asAdmin.query(api.ai.admin.revealKey, { purpose: 'chat' });
    expect(key).toBeNull();
  });

  it('rejects non-admin', async () => {
    const t = convexTest(schema, modules);
    const asUser = await seedPatient(t);
    await expect(
      asUser.query(api.ai.admin.revealKey, { purpose: 'chat' })
    ).rejects.toThrow(/admin/i);
  });
});

describe('ai.admin per-topic prompts', () => {
  it('savePrompt with topic creates a variant; overview lists it', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.savePrompt, {
      purpose: 'chat',
      systemPrompt: 'global',
    });
    await asAdmin.mutation(api.ai.admin.savePrompt, {
      purpose: 'chat',
      topic: 'sexual-wellbeing',
      systemPrompt: 'wellbeing variant',
    });
    const ov = await asAdmin.query(api.ai.admin.overview, {});
    const chat = ov.purposes.find((p) => p.purpose === 'chat');
    expect(chat?.prompt?.systemPrompt).toBe('global');
    expect(chat?.topicVariants).toEqual([
      expect.objectContaining({
        topic: 'sexual-wellbeing',
        prompt: expect.objectContaining({ systemPrompt: 'wellbeing variant' }),
      }),
    ]);
  });

  it('resetPromptToDefault with topic restores the canonical variant', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.savePrompt, {
      purpose: 'chat',
      topic: 'sexual-wellbeing',
      systemPrompt: 'garbage',
    });
    await asAdmin.mutation(api.ai.admin.resetPromptToDefault, {
      purpose: 'chat',
      topic: 'sexual-wellbeing',
    });
    const active = await t.run((ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, {
        purpose: 'chat',
        topic: 'sexual-wellbeing',
      })
    );
    expect(active.topic).toBe('sexual-wellbeing');
    expect(active.systemPrompt).toContain('sex-positive');
  });
});

describe('ai.admin.savePrompt + resetPromptToDefault', () => {
  it('savePrompt versions the prompt; latest wins', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.savePrompt, {
      purpose: 'chat',
      systemPrompt: 'v1',
    });
    await asAdmin.mutation(api.ai.admin.savePrompt, {
      purpose: 'chat',
      systemPrompt: 'v2',
      temperature: 0.5,
      maxTokens: 200,
    });
    const active = await t.run((ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, { purpose: 'chat' })
    );
    expect(active.systemPrompt).toBe('v2');
    expect(active.temperature).toBe(0.5);
  });

  it('savePrompt rejects empty system prompt', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await expect(
      asAdmin.mutation(api.ai.admin.savePrompt, { purpose: 'chat', systemPrompt: '   ' })
    ).rejects.toThrow(/vazio/i);
  });

  it('resetPromptToDefault restores the canonical default', async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.ai.admin.savePrompt, {
      purpose: 'chat-summary',
      systemPrompt: 'garbage override',
    });
    await asAdmin.mutation(api.ai.admin.resetPromptToDefault, { purpose: 'chat-summary' });
    const active = await t.run((ctx) =>
      ctx.runQuery(internal.ai.prompts.getActivePrompt, { purpose: 'chat-summary' })
    );
    expect(active.systemPrompt).toContain('assistente clínico');
    expect(active.systemPrompt).not.toBe('garbage override');
  });
});
