import { query, mutation } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export const listByTopic = query({
  args: {
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.topic) {
      return ctx.db
        .query('educationalContent')
        .withIndex('by_topic', (q) => q.eq('topic', args.topic as any))
        .filter((q) => q.eq(q.field('isPublished'), true))
        .collect();
    }
    return ctx.db
      .query('educationalContent')
      .withIndex('by_published', (q) => q.eq('isPublished', true))
      .collect();
  },
});

export const get = query({
  args: { id: v.id('educationalContent') },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id('educationalContent')),
    title: v.string(),
    topic: v.union(
      v.literal('contraception'),
      v.literal('pregnancy'),
      v.literal('sti'),
      v.literal('menstrual-cycle'),
      v.literal('general')
    ),
    content: v.string(),
    summary: v.string(),
    tags: v.array(v.string()),
    isPublished: v.boolean(),
    readingTimeMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'admin') throw new Error('Unauthorized');
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return ctx.db.insert('educationalContent', data);
  },
});
