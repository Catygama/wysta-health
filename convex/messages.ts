import { mutation, query } from './_generated/server';
import { hasProfessionalAccess } from './lib/professional';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { professionalCanSeeAi } from './conversations';
import { userError, NOT_AUTHENTICATED, NOT_ALLOWED } from './lib/errors';
import { storedAttachmentError } from './lib/attachments';

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
    const isProfessional = hasProfessionalAccess(profile);
    // The patient, or an admin / approved professional (a pending or rejected
    // professional has no access, even to a case once assigned to them).
    const hasAccess = conv.patientId === userId || isProfessional;
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
    messageType: v.optional(
      v.union(
        v.literal('text'),
        v.literal('image'),
        v.literal('file'),
        v.literal('system'),
        v.literal('triage-response')
      )
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
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw userError('Esta conversa já não existe.');
    const senderProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    // Only the conversation's members write in it: the patient who owns it,
    // or the professional assigned to it (still approved). The AI assistant
    // writes through internal functions, never through here.
    const isPatient = conv.patientId === userId;
    const isAssignedProfessional =
      conv.professionalId === userId && hasProfessionalAccess(senderProfile);
    if (!isPatient && !isAssignedProfessional) throw userError(NOT_ALLOWED);
    if (conv.status === 'closed') {
      throw userError('Esta conversa foi encerrada. Já não é possível enviar mensagens.');
    }
    // Chats with the AI are read-only for professionals.
    if (conv.kind === 'ai-only' && !isPatient) {
      throw userError('Só a utente pode escrever na conversa com a assistente IA.');
    }
    // Internal notes are for the assigned professional only.
    if (args.isInternal && !isAssignedProfessional) {
      throw userError('Só o profissional atribuído pode escrever notas internas.');
    }

    const messageType = args.messageType ?? 'text';
    // System lines and triage summaries are written by the server only.
    if (messageType !== 'text' && messageType !== 'image' && messageType !== 'file') {
      throw userError('Tipo de mensagem inválido.');
    }
    // Clinical safety and data protection: the AI assistant doesn't analyse
    // images or documents, so AI chats take text only.
    if (conv.kind === 'ai-only' && messageType !== 'text') {
      throw userError('A assistente IA não analisa imagens nem documentos.');
    }

    // Attachments: checked against the stored file's real type and size, not
    // what the client says.
    let attachmentMimeType: string | undefined;
    let attachmentSize: number | undefined;
    for (const [storageId, kind] of [
      [args.imageId, 'image'],
      [args.attachmentId, 'document'],
    ] as const) {
      if (!storageId) continue;
      const meta = await ctx.db.system.get(storageId);
      if (!meta) throw userError('O ficheiro não foi encontrado. Tenta enviá-lo de novo.');
      const problem = storedAttachmentError(meta, kind);
      if (problem) throw userError(problem);
      if (kind === 'document') {
        attachmentMimeType = meta.contentType;
        attachmentSize = meta.size;
      }
    }

    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content,
      messageType,
      imageId: args.imageId,
      attachmentId: args.attachmentId,
      attachmentName: args.attachmentId ? args.attachmentName : undefined,
      attachmentMimeType,
      attachmentSize,
      isInternal: args.isInternal || undefined,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });

    if (args.isInternal) return;

    // ai-only conversations auto-trigger an AI reply when the patient sends
    // a text message. The action is scheduled so the mutation returns
    // promptly and the patient sees their own message land first.
    if (conv.kind === 'ai-only' && isPatient && messageType === 'text') {
      await ctx.scheduler.runAfter(0, internal.ai.assistant.respondAuto, {
        conversationId: args.conversationId,
        query: args.content,
      });
      return;
    }

    if (isPatient) return;

    // Lock screens are visible to others: never put message content (or
    // attachment names) in the notification.
    const senderName = senderProfile?.displayName?.trim();
    await ctx.scheduler.runAfter(0, internal.notifications.sendToUser, {
      userId: conv.patientId,
      title: senderName
        ? `Nova mensagem de ${senderName}`
        : 'Nova mensagem de um profissional',
      data: { conversationId: args.conversationId },
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    return ctx.storage.generateUploadUrl();
  },
});
