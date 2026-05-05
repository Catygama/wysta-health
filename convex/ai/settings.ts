// Org-wide AI settings (single-tenant — no multi-org). Append-only: each
// change inserts a new row, latest by _creationTime wins. Read by runAgent
// to enforce per-user daily cost cap.

import { internalQuery, mutation, query } from '../_generated/server';
import { v } from 'convex/values';
import { requireAdmin } from '../lib/auth';

export const DEFAULT_DAILY_COST_CAP_USD = 1.0;

// Internal: latest cap. Fallback to default if no row was ever inserted.
export const getDailyCostCap = internalQuery({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query('aiSettings').order('desc').first();
    return latest?.dailyCostCapUsd ?? DEFAULT_DAILY_COST_CAP_USD;
  },
});

export const updateDailyCostCap = mutation({
  args: {
    dailyCostCapUsd: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { dailyCostCapUsd, notes }) => {
    const { userId } = await requireAdmin(ctx);
    if (dailyCostCapUsd <= 0 || dailyCostCapUsd > 100) {
      throw new Error('Cap must be between 0 and 100 USD');
    }
    return ctx.db.insert('aiSettings', {
      dailyCostCapUsd,
      createdBy: userId,
      notes,
    });
  },
});

// Admin: latest settings row + history.
export const currentSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const latest = await ctx.db.query('aiSettings').order('desc').first();
    return {
      dailyCostCapUsd: latest?.dailyCostCapUsd ?? DEFAULT_DAILY_COST_CAP_USD,
      hasOverride: !!latest,
      lastChangedAt: latest?._creationTime,
    };
  },
});

export const settingsHistory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query('aiSettings').order('desc').take(50);
  },
});
