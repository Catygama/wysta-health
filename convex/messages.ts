import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { professionalCanSeeAi } from './conversations';

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
    if (
      conv.kind === 'ai-only' &&
      conv.patientId !== userId &&
      !(await professionalCanSeeAi(ctx, conv, userId))
    ) {
      return [];
    }
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
        attachmentUrl: m.attachmentId
          ? await ctx.storage.getUrl(m.attachmentId)
          : null,
      }))
    );
  },
});

export const send = mutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    // System and triage messages are written server-side only.
    messageType: v.optional(
      v.union(v.literal('text'), v.literal('image'), v.literal('file'))
    ),
    imageId: v.optional(v.id('_storage')),
    attachmentId: v.optional(v.id('_storage')),
    attachmentName: v.optional(v.string()),
    attachmentMimeType: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error('Conversation not found');

    const isPatient = conv.patientId === userId;
    const isAssignedProfessional = conv.professionalId === userId;
    if (!isPatient && !isAssignedProfessional) {
      throw new Error('Sem acesso a esta conversa.');
    }
    if (args.isInternal && !isAssignedProfessional) {
      throw new Error('Só o profissional atribuído pode escrever notas internas.');
    }

    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content,
      messageType: args.messageType ?? 'text',
      imageId: args.imageId,
      attachmentId: args.attachmentId,
      attachmentName: args.attachmentName,
      attachmentMimeType: args.attachmentMimeType,
      attachmentSize: args.attachmentSize,
      isInternal: args.isInternal,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });

    if (args.isInternal) return;

    // ai-only conversations auto-trigger an AI reply when the patient sends
    // a text message. The action is scheduled so the mutation returns
    // promptly and the patient sees their own message land first.
    if (
      conv.kind === 'ai-only' &&
      conv.patientId === userId &&
      (args.messageType ?? 'text') === 'text'
    ) {
      await ctx.scheduler.runAfter(0, internal.ai.assistant.respondAuto, {
        conversationId: args.conversationId,
        query: args.content,
      });
      return;
    }

    if (conv.patientId === userId) return;

    const senderProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isProfessional =
      senderProfile?.role === 'professional' ||
      senderProfile?.role === 'admin';
    if (!isProfessional) return;

    // Chats with the AI are read-only for professionals.
    if (conv.kind === 'ai-only') {
      throw new Error('Só a utente pode escrever na conversa com a assistente IA.');
    }

    const preview =
      args.messageType === 'image'
        ? 'Enviou uma imagem'
        : args.messageType === 'file'
          ? `Enviou um documento${args.attachmentName ? `: ${args.attachmentName}` : ''}`
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
