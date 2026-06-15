// Patient sexual-wellbeing check-ins (SHAPE-inspired). Append-only: each
// submission is a new row, giving a trend over time. Identity is derived
// server-side; users only ever read/write their own check-ins.
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

function assertScore(n: number, min: number, max: number, label: string) {
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${label} deve estar entre ${min} e ${max}.`);
  }
}

export const submitCheckin = mutation({
  args: {
    desire: v.number(),
    satisfaction: v.number(),
    pain: v.number(),
    distress: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    assertScore(args.desire, 1, 5, 'Desejo');
    assertScore(args.satisfaction, 1, 5, 'Satisfação');
    assertScore(args.pain, 0, 5, 'Dor');
    assertScore(args.distress, 1, 5, 'Mal-estar');
    return ctx.db.insert('wellbeingCheckins', {
      userId,
      desire: args.desire,
      satisfaction: args.satisfaction,
      pain: args.pain,
      distress: args.distress,
      note: args.note?.trim() || undefined,
    });
  },
});

export const listCheckins = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query('wellbeingCheckins')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit ?? 30);
  },
});

export const latestCheckin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query('wellbeingCheckins')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .first();
  },
});
