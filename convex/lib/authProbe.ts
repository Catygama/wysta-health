import { internalMutation } from '../_generated/server';
import { requireAdmin } from './auth';

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireAdmin(ctx);
    return { role: profile.role };
  },
});
