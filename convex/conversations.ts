import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export const listForPatient = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', userId))
      .order('desc')
      .collect();
  },
});

export const listForProfessional = query({
  args: {
    status: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'professional' && profile?.role !== 'admin') return [];
    if (args.status) {
      return ctx.db
        .query('conversations')
        .withIndex('by_status', (q) => q.eq('status', args.status as any))
        .collect();
    }
    return ctx.db.query('conversations').collect();
  },
});

export const get = query({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const conv = await ctx.db.get(args.id);
    if (!conv) return null;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const hasAccess =
      conv.patientId === userId ||
      conv.professionalId === userId ||
      profile?.role === 'professional' ||
      profile?.role === 'admin';
    if (!hasAccess) return null;
    return conv;
  },
});

export const create = mutation({
  args: {
    topic: v.union(
      v.literal('contraception'),
      v.literal('pregnancy'),
      v.literal('sti'),
      v.literal('menstrual-cycle')
    ),
    title: v.string(),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent')
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    return ctx.db.insert('conversations', {
      patientId: userId,
      topic: args.topic,
      title: args.title,
      priority: args.priority,
      status: 'waiting',
      lastMessageAt: Date.now(),
    });
  },
});

export const assign = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'professional') throw new Error('Unauthorized');
    await ctx.db.patch(args.id, {
      professionalId: userId,
      status: 'active',
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'assigned',
      details: 'Conversa atribuída ao profissional',
    });
  },
});

export const close = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'professional') throw new Error('Unauthorized');
    await ctx.db.patch(args.id, { status: 'closed' });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'closure',
      details: 'Conversa encerrada',
    });
  },
});

export const escalate = mutation({
  args: {
    id: v.id('conversations'),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'professional' && profile?.role !== 'admin') throw new Error('Unauthorized');
    await ctx.db.patch(args.id, {
      status: 'escalated',
      priority: 'urgent',
      escalationNotes: args.notes,
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'escalation',
      details: args.notes,
    });
  },
});
