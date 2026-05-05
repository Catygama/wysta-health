import { v } from 'convex/values';
import { mutation, query, internalQuery } from '../_generated/server';
import { requireAdmin } from '../lib/auth';

const aiPurpose = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge')
);

const aiProvider = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('mistral'),
  v.literal('google'),
  v.literal('azure-openai'),
  v.literal('custom')
);

function maskApiKey(key: string): string {
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
