import { v } from 'convex/values';
import { internalMutation, internalQuery, query } from '../_generated/server';
import { requireAdmin } from '../lib/auth';
import { aiPurposeValidator as aiPurpose } from './registry';

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

// Internal: total USD spent on AI by a given user in the last 24h.
// Used by runAgent's per-user daily cost cap.
export const dailySpentForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query('aiInvocations')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.gte(q.field('_creationTime'), since))
      .take(500);
    return rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  },
});

// Admin-only audit query: list the most recent invocations across all purposes.
export const listLatest = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query('aiInvocations').order('desc').take(10);
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

// Cost per assistant response, for reporting. A response is a root 'chat'
// invocation (the draft); its safety/clinical validators and the judge are
// children via parentInvocationId, so each response's cost includes them.
// Summaries (chat-summary, user-summary) are separate agents, reported apart.
// Run from the Convex dashboard: ai/invocations:costPerResponse, args {}.
// From the CLI, --prod only reaches production with CONVEX_DEPLOY_KEY set.
// (optionally { sinceMs } to count only invocations created after that time).
export const costPerResponse = internalQuery({
  args: { sinceMs: v.optional(v.number()) },
  handler: async (ctx, { sinceMs }) => {
    const since = sinceMs ?? 0;
    const byPurpose: Record<string, { count: number; costUsd: number }> = {};
    const add = (purpose: string, cost: number) => {
      const row = (byPurpose[purpose] ??= { count: 0, costUsd: 0 });
      row.count++;
      row.costUsd += cost;
    };
    let responses = 0;
    let chainCostUsd = 0;
    let withoutCost = 0;
    for await (const draft of ctx.db
      .query('aiInvocations')
      .withIndex('by_purpose', (q) => q.eq('purpose', 'chat'))) {
      if (draft.parentInvocationId || draft._creationTime < since) continue;
      responses++;
      if (draft.costUsd === undefined) withoutCost++;
      chainCostUsd += draft.costUsd ?? 0;
      add(draft.purpose, draft.costUsd ?? 0);
      for await (const step of ctx.db
        .query('aiInvocations')
        .withIndex('by_parent', (q) => q.eq('parentInvocationId', draft._id))) {
        if (step.costUsd === undefined) withoutCost++;
        chainCostUsd += step.costUsd ?? 0;
        add(step.purpose, step.costUsd ?? 0);
      }
    }
    const summaries: Record<string, { count: number; costUsd: number }> = {};
    for (const purpose of ['chat-summary', 'user-summary'] as const) {
      const row = (summaries[purpose] = { count: 0, costUsd: 0 });
      for await (const inv of ctx.db
        .query('aiInvocations')
        .withIndex('by_purpose', (q) => q.eq('purpose', purpose))) {
        if (inv._creationTime < since) continue;
        row.count++;
        row.costUsd += inv.costUsd ?? 0;
      }
    }
    return {
      responses,
      chainCostUsd,
      costPerResponseUsd: responses ? chainCostUsd / responses : null,
      // Invocations in the chain with no recorded cost (errors before the
      // provider answered, or pending): counted as 0.
      invocationsWithoutCost: withoutCost,
      byPurpose,
      summaries,
    };
  },
});
