import { query } from './_generated/server';
import { v } from 'convex/values';

const topic = v.union(
  v.literal('contraception'),
  v.literal('pregnancy'),
  v.literal('sti'),
  v.literal('menstrual-cycle'),
  v.literal('general')
);

export const getByTopic = query({
  args: { topic },
  handler: async (ctx, args) => {
    return ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
  },
});
