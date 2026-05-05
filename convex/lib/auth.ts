import { getAuthUserId } from '@convex-dev/auth/server';
import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';

export type AdminContext = {
  userId: Doc<'userProfiles'>['userId'];
  profile: Doc<'userProfiles'>;
};

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<AdminContext> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Not authenticated');
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Admin only');
  }
  return { userId, profile };
}
