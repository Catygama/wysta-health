import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return { ...user, profile };
  },
});

export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) return existing;
    const id = await ctx.db.insert('userProfiles', {
      userId,
      role: 'patient',
    });
    return ctx.db.get(id);
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    ageRange: v.optional(v.string()),
    location: v.optional(v.string()),
    pregnancyStatus: v.optional(v.string()),
    conditions: v.optional(v.array(v.string())),
    medications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!profile) throw new Error('Profile not found');
    await ctx.db.patch(profile._id, args);
  },
});

export const setRole = mutation({
  args: {
    targetUserId: v.id('users'),
    role: v.union(
      v.literal('patient'),
      v.literal('professional'),
      v.literal('admin')
    ),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error('Not authenticated');
    const callerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    if (callerProfile?.role !== 'admin') throw new Error('Unauthorized');
    const targetProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.targetUserId))
      .unique();
    if (!targetProfile) throw new Error('Target user profile not found');
    await ctx.db.patch(targetProfile._id, { role: args.role });
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];
    const callerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    if (callerProfile?.role !== 'admin') return [];
    const profiles = await ctx.db.query('userProfiles').collect();
    return Promise.all(
      profiles.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return { ...p, user };
      })
    );
  },
});
