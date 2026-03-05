import { query, mutation } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export const getByTopic = query({
  args: {
    topic: v.union(
      v.literal('contraception'),
      v.literal('pregnancy'),
      v.literal('sti'),
      v.literal('menstrual-cycle')
    ),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
  },
});

export const seed = mutation({
  args: {
    topic: v.union(
      v.literal('contraception'),
      v.literal('pregnancy'),
      v.literal('sti'),
      v.literal('menstrual-cycle')
    ),
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        type: v.union(
          v.literal('multiple-choice'),
          v.literal('yes-no'),
          v.literal('text')
        ),
        options: v.optional(v.array(v.string())),
        isRedFlag: v.optional(v.boolean()),
        required: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { questions: args.questions });
    } else {
      await ctx.db.insert('triageQuestions', {
        topic: args.topic,
        questions: args.questions,
      });
    }
  },
});
