import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

export const list = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isProfessional =
      profile?.role === 'professional' || profile?.role === 'admin';
    const hasAccess =
      conv.patientId === userId ||
      conv.professionalId === userId ||
      isProfessional;
    if (!hasAccess) return [];
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();
    const filtered = isProfessional
      ? messages
      : messages.filter((m) => !m.isInternal);
    return Promise.all(
      filtered.map(async (m) => ({
        ...m,
        imageUrl: m.imageId ? await ctx.storage.getUrl(m.imageId) : null,
      }))
    );
  },
});

export const send = mutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    messageType: v.optional(
      v.union(
        v.literal('text'),
        v.literal('image'),
        v.literal('system'),
        v.literal('triage-response')
      )
    ),
    imageId: v.optional(v.id('_storage')),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content,
      messageType: args.messageType ?? 'text',
      imageId: args.imageId,
      isInternal: args.isInternal,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });

    if (args.isInternal) return;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return;
    if (conv.patientId === userId) return;

    const senderProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isProfessional =
      senderProfile?.role === 'professional' ||
      senderProfile?.role === 'admin';
    if (!isProfessional) return;

    const preview =
      args.messageType === 'image'
        ? 'Enviou uma imagem'
        : args.content.slice(0, 200);

    await ctx.scheduler.runAfter(0, internal.notifications.sendToUser, {
      userId: conv.patientId,
      title: senderProfile?.displayName ?? 'Profissional Wysta',
      body: preview,
      data: { conversationId: args.conversationId },
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    return ctx.storage.generateUploadUrl();
  },
});
