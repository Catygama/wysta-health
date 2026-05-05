import { v } from 'convex/values';
import { internalMutation, query } from '../_generated/server';
import { requireAdmin } from '../lib/auth';

const aiPurpose = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge')
);

const aiInvocationStatus = v.union(
  v.literal('pending'),
  v.literal('success'),
  v.literal('error'),
  v.literal('blocked')
);

export const createInvocation = internalMutation({
  args: {
    purpose: aiPurpose,
    configId: v.id('aiConfigs'),
    promptId: v.id('aiPrompts'),
    userId: v.optional(v.id('users')),
    conversationId: v.optional(v.id('conversations')),
    parentInvocationId: v.optional(v.id('aiInvocations')),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('aiInvocations', {
      ...args,
      status: 'pending',
    });
  },
});

export const completeInvocation = internalMutation({
  args: {
    invocationId: v.id('aiInvocations'),
    status: aiInvocationStatus,
    errorMessage: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, { invocationId, ...patch }) => {
    await ctx.db.patch(invocationId, patch);
  },
});

// Admin-only audit query: list invocations for a conversation, newest first.
export const listForConversation = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('aiInvocations')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(100);
  },
});

// Admin-only audit query: list the most recent invocations across all purposes.
export const listLatest = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query('aiInvocations').order('desc').take(50);
  },
});

// Admin-only audit query: list invocations in a chain (root + descendants by parentId).
export const listChain = query({
  args: { rootId: v.id('aiInvocations') },
  handler: async (ctx, { rootId }) => {
    await requireAdmin(ctx);
    const root = await ctx.db.get(rootId);
    if (!root) return [];
    const children = await ctx.db
      .query('aiInvocations')
      .withIndex('by_parent', (q) => q.eq('parentInvocationId', rootId))
      .take(50);
    return [root, ...children];
  },
});
