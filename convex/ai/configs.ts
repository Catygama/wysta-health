import { v } from 'convex/values';
import { mutation, query, internalQuery } from '../_generated/server';
import { requireAdmin } from '../lib/auth';
import { DEFAULT_PROMPTS, DEFAULT_CONFIGS } from './defaults';
import { aiPurposeValidator as aiPurpose, aiProviderValidator as aiProvider } from './registry';

export function maskApiKey(key: string): string {
  if (!key) return '—';
  const last4 = key.slice(-4);
  return `sk-…${last4}`;
}

// INTERNAL — returns the FULL document including apiKey. Never expose publicly.
export const getActiveConfig = internalQuery({
  args: { purpose: aiPurpose },
  handler: async (ctx, { purpose }) => {
    const config = await ctx.db
      .query('aiConfigs')
      .withIndex('by_purpose', (q) => q.eq('purpose', purpose))
      .order('desc')
      .first();
    if (!config) {
      throw new Error(`No aiConfigs row for purpose: ${purpose}`);
    }
    return config;
  },
});

export const insertConfig = mutation({
  args: {
    purpose: aiPurpose,
    provider: aiProvider,
    modelId: v.string(),
    endpoint: v.optional(v.string()),
    apiKey: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    return ctx.db.insert('aiConfigs', { ...args, createdBy: userId });
  },
});

export const listConfigsMasked = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query('aiConfigs').order('desc').take(200);
    return rows.map((r) => ({ ...r, apiKey: maskApiKey(r.apiKey) }));
  },
});

// Admin convenience: insert canonical default config + prompt for a purpose
// in one call. Caller supplies only the apiKey (which we never bake into the
// repo). Source of truth for the prompt + model lives in convex/ai/defaults.ts.
export const applyDefaults = mutation({
  args: { purpose: aiPurpose, apiKey: v.string() },
  handler: async (ctx, { purpose, apiKey }) => {
    const { userId } = await requireAdmin(ctx);

    const cfg = DEFAULT_CONFIGS[purpose];
    const prompt = DEFAULT_PROMPTS[purpose];
    if (!cfg || !prompt) {
      throw new Error(`No default registered for purpose: ${purpose}`);
    }

    const configId = await ctx.db.insert('aiConfigs', {
      purpose,
      provider: cfg.provider,
      modelId: cfg.modelId,
      apiKey,
      createdBy: userId,
      notes: `default applied via admin UI`,
    });
    const promptId = await ctx.db.insert('aiPrompts', {
      purpose,
      systemPrompt: prompt.systemPrompt,
      userTemplate: prompt.userTemplate,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
      createdBy: userId,
      notes: `default applied via admin UI`,
    });
    return { configId, promptId };
  },
});

export const listConfigHistory = query({
  args: { purpose: aiPurpose },
  handler: async (ctx, { purpose }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query('aiConfigs')
      .withIndex('by_purpose', (q) => q.eq('purpose', purpose))
      .order('desc')
      .take(100);
    return rows.map((r) => ({ ...r, apiKey: maskApiKey(r.apiKey) }));
  },
});
