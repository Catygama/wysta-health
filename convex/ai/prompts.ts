import { v } from 'convex/values';
import { mutation, query, internalQuery } from '../_generated/server';
import { requireAdmin } from '../lib/auth';
import { aiPurposeValidator as aiPurpose } from './registry';

export const getActivePrompt = internalQuery({
  args: { purpose: aiPurpose },
  handler: async (ctx, { purpose }) => {
    const prompt = await ctx.db
      .query('aiPrompts')
      .withIndex('by_purpose', (q) => q.eq('purpose', purpose))
      .order('desc')
      .first();
    if (!prompt) {
      throw new Error(`No aiPrompts row for purpose: ${purpose}`);
    }
    return prompt;
  },
});

export const insertPrompt = mutation({
  args: {
    purpose: aiPurpose,
    systemPrompt: v.string(),
    userTemplate: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    return ctx.db.insert('aiPrompts', { ...args, createdBy: userId });
  },
});

export const listPrompts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query('aiPrompts').order('desc').take(200);
  },
});

export const listPromptHistory = query({
  args: { purpose: aiPurpose },
  handler: async (ctx, { purpose }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('aiPrompts')
      .withIndex('by_purpose', (q) => q.eq('purpose', purpose))
      .order('desc')
      .take(100);
  },
});
