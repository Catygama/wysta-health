import { v } from 'convex/values';
import { mutation, query, internalQuery } from '../_generated/server';
import { requireAdmin } from '../lib/auth';
import { aiPurposeValidator as aiPurpose } from './registry';
import { topicValidator } from '../lib/topics';

export const getActivePrompt = internalQuery({
  args: { purpose: aiPurpose, topic: v.optional(topicValidator) },
  handler: async (ctx, { purpose, topic }) => {
    // Topic-specific variant takes precedence when one exists.
    if (topic) {
      const variant = await ctx.db
        .query('aiPrompts')
        .withIndex('by_purpose_and_topic', (q) =>
          q.eq('purpose', purpose).eq('topic', topic)
        )
        .order('desc')
        .first();
      if (variant) return variant;
    }
    // Fall back to the global prompt (topic unset). Documents inserted without
    // a topic field are indexed as `undefined`, so eq('topic', undefined) finds them.
    const global = await ctx.db
      .query('aiPrompts')
      .withIndex('by_purpose_and_topic', (q) =>
        q.eq('purpose', purpose).eq('topic', undefined)
      )
      .order('desc')
      .first();
    if (!global) {
      throw new Error(`No aiPrompts row for purpose: ${purpose}`);
    }
    return global;
  },
});

export const insertPrompt = mutation({
  args: {
    purpose: aiPurpose,
    topic: v.optional(topicValidator),
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
