import { query } from './_generated/server';
import { topicValidator as topic } from './lib/topics';

export const getByTopic = query({
  args: { topic },
  handler: async (ctx, args) => {
    return ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
  },
});
