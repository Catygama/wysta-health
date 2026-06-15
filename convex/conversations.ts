import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import {
  calculateRiskLevel,
  priorityFromRisk,
  type RiskAssessment,
} from './lib/risk';
import { topicValidator as topic } from './lib/topics';

const status = v.union(
  v.literal('waiting'),
  v.literal('active'),
  v.literal('escalated'),
  v.literal('closed')
);

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortByPriorityThenRecency<T extends { priority: string; lastMessageAt: number }>(
  items: T[]
) {
  return [...items].sort((a, b) => {
    const ap = PRIORITY_RANK[a.priority] ?? 0;
    const bp = PRIORITY_RANK[b.priority] ?? 0;
    if (ap !== bp) return bp - ap;
    return b.lastMessageAt - a.lastMessageAt;
  });
}

export const listForPatient = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', userId))
      .order('desc')
      .collect();

    // Enrich each conversation for the care-feed home: latest visible message
    // preview + the most recent professional responder's name (continuity is
    // shown, never promised — null falls back to "Equipa Wysta" in the UI).
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const recent = await ctx.db
          .query('messages')
          .withIndex('by_conversation', (q) => q.eq('conversationId', conv._id))
          .order('desc')
          .take(15);
        const visible = recent.filter((m) => !m.isInternal);
        const last = visible[0];
        const lastFromPro = visible.find((m) => m.senderId !== userId);
        let responderName: string | null = null;
        if (lastFromPro && conv.kind !== 'ai-only') {
          const profile = await ctx.db
            .query('userProfiles')
            .withIndex('by_user', (q) => q.eq('userId', lastFromPro.senderId))
            .unique();
          responderName = profile?.displayName ?? null;
        }
        return {
          ...conv,
          preview: last?.content ?? null,
          previewAt: last?._creationTime ?? null,
          responderName,
          isAiOnly: conv.kind === 'ai-only',
        };
      })
    );

    return enriched.sort(
      (a, b) =>
        (b.previewAt ?? b.lastMessageAt ?? b._creationTime) -
        (a.previewAt ?? a.lastMessageAt ?? a._creationTime)
    );
  },
});

export const listForProfessional = query({
  args: {
    status: v.optional(status),
    scope: v.optional(
      v.union(
        v.literal('all'),
        v.literal('mine'),
        v.literal('unassigned'),
        v.literal('review')
      )
    ),
    priority: v.optional(
      v.union(
        v.literal('low'),
        v.literal('medium'),
        v.literal('high'),
        v.literal('urgent')
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'professional' && profile?.role !== 'admin') return [];

    let conversations = args.status
      ? await ctx.db
          .query('conversations')
          .withIndex('by_status', (q) => q.eq('status', args.status as any))
          .collect()
      : await ctx.db.query('conversations').collect();

    // Hide ai-only conversations from the professional queue unless the
    // patient has explicitly requested human handoff.
    conversations = conversations.filter(
      (c) => c.kind !== 'ai-only' || c.aiHandoffRequestedAt
    );

    if (args.scope === 'mine') {
      conversations = conversations.filter((c) => c.professionalId === userId);
    } else if (args.scope === 'unassigned') {
      conversations = conversations.filter((c) => !c.professionalId);
    } else if (args.scope === 'review') {
      conversations = conversations.filter((c) => c.needsReview === true);
    }

    if (args.priority) {
      conversations = conversations.filter((c) => c.priority === args.priority);
    }

    return sortByPriorityThenRecency(conversations);
  },
});

export const queueStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (profile?.role !== 'professional' && profile?.role !== 'admin') return null;
    const all = (await ctx.db.query('conversations').collect()).filter(
      (c) => c.kind !== 'ai-only' || c.aiHandoffRequestedAt
    );
    return {
      mine: all.filter((c) => c.professionalId === userId && c.status !== 'closed').length,
      unassigned: all.filter((c) => !c.professionalId && c.status === 'waiting').length,
      review: all.filter((c) => c.needsReview === true && c.status !== 'closed').length,
      urgent: all.filter((c) => c.priority === 'urgent' && c.status !== 'closed').length,
    };
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
    const isProfessional =
      profile?.role === 'professional' || profile?.role === 'admin';
    const patient = await ctx.db.get(conv.patientId);
    const patientProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', conv.patientId))
      .unique();
    const patientPayload = patient
      ? {
          email: patient.email,
          displayName: patientProfile?.displayName,
          ageRange: patientProfile?.ageRange,
          location: patientProfile?.location,
          pregnancyStatus: patientProfile?.pregnancyStatus,
          // Clinical fields only exposed to professionals/admins
          conditions: isProfessional ? patientProfile?.conditions : undefined,
          medications: isProfessional ? patientProfile?.medications : undefined,
          aiSummary: isProfessional ? patientProfile?.aiSummary : undefined,
          aiSummaryAt: isProfessional ? patientProfile?.aiSummaryAt : undefined,
        }
      : null;
    return { ...conv, patient: patientPayload };
  },
});

export const create = mutation({
  args: {
    topic,
    title: v.string(),
    triageData: v.optional(
      v.object({
        responses: v.record(v.string(), v.any()),
      })
    ),
    kind: v.optional(
      v.union(v.literal('human-async'), v.literal('ai-only'))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (args.triageData) {
      const triage = await ctx.db
        .query('triageQuestions')
        .withIndex('by_topic', (q) => q.eq('topic', args.topic))
        .unique();
      riskLevel = calculateRiskLevel(
        args.triageData.responses,
        triage?.riskAssessment as RiskAssessment | undefined
      );
    }

    const priority = priorityFromRisk(riskLevel);
    const kind = args.kind ?? 'human-async';
    const conversationId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: args.topic,
      title: args.title,
      priority,
      // ai-only conversations skip the queue and go straight to active.
      status: kind === 'ai-only' ? 'active' : 'waiting',
      lastMessageAt: Date.now(),
      riskLevel,
      kind,
    });

    if (args.triageData) {
      await ctx.db.insert('messages', {
        conversationId,
        senderId: userId,
        content: 'Questionário de triagem concluído.',
        messageType: 'triage-response',
        metadata: {
          triageData: {
            topic: args.topic,
            responses: args.triageData.responses,
            riskLevel,
          },
        },
      });
    }

    return conversationId;
  },
});

async function requireProfessional(ctx: any, userId: any) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .unique();
  if (profile?.role !== 'professional' && profile?.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  return profile;
}

export const assign = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.status === 'closed') {
      throw new Error('Conversa fechada não pode ser reatribuída');
    }
    if (conv.professionalId === userId) return; // already mine, no-op
    const wasAssignedToOther = !!conv.professionalId;
    await ctx.db.patch(args.id, {
      professionalId: userId,
      status: 'active',
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'assigned',
      details: wasAssignedToOther
        ? 'Conversa reatribuída ao profissional (take-over)'
        : 'Conversa atribuída ao profissional',
    });
  },
});

export const unassign = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.professionalId !== userId) throw new Error('Não atribuído a si');
    await ctx.db.patch(args.id, {
      professionalId: undefined,
      status: 'waiting',
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'unassigned',
      details: 'Conversa libertada',
    });
  },
});

export const close = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const now = Date.now();
    await ctx.db.patch(args.id, { status: 'closed', lastMessageAt: now });
    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content: 'Conversa encerrada pelo profissional de saúde.',
      messageType: 'system',
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'closure',
      details: 'Conversa encerrada',
    });
    // Schedule AI summary generation in the background. If config/prompt
    // are missing or generation fails, the close still succeeds — the
    // summary just doesn't exist (handled by the action's own try/catch).
    await ctx.scheduler.runAfter(
      0,
      internal.ai.chatSummary.generateOnClose,
      { conversationId: args.id, triggeredBy: userId }
    );
  },
});

// Bumps priority to 'urgent' and writes an audit row. Idempotent.
// Replaces the old "escalate" flow's priority side-effect.
export const markUrgent = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.status === 'closed') {
      throw new Error('Conversa fechada — reabrir para alterar prioridade');
    }
    if (conv.priority === 'urgent') return;
    await ctx.db.patch(args.id, { priority: 'urgent' });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'priority-change',
      details: `${conv.priority} → urgent`,
    });
  },
});

// Flags a conversation for second-opinion review by another professional.
// Question is stored on the conversation + posted as an internal note so
// the back-and-forth lives with the rest of the conversation context.
export const requestReview = mutation({
  args: { id: v.id('conversations'), question: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const trimmed = args.question.trim();
    if (trimmed.length < 5) throw new Error('Pergunta demasiado curta');
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.status === 'closed') throw new Error('Conversa fechada');
    await ctx.db.patch(args.id, {
      needsReview: true,
      reviewQuestion: trimmed,
      reviewRequestedBy: userId,
    });
    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content: `Pedido de 2ª opinião: ${trimmed}`,
      messageType: 'text',
      isInternal: true,
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'review-requested',
      details: trimmed,
    });
  },
});

// Clears the review flag (after another professional has responded
// internally, or the original requester decides it's resolved).
export const clearReview = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (!conv.needsReview) return;
    await ctx.db.patch(args.id, {
      needsReview: false,
      reviewQuestion: undefined,
      reviewRequestedBy: undefined,
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'review-cleared',
      details: 'Pedido de revisão resolvido',
    });
  },
});

// Sends a templated message to the patient recommending in-person care.
// Optionally closes the conversation with closureReason='redirected-to-in-person'.
export const recommendInPerson = mutation({
  args: {
    id: v.id('conversations'),
    alsoClose: v.optional(v.boolean()),
    extraNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.status === 'closed') throw new Error('Conversa já fechada');

    const baseMsg =
      'Pelo que descreves, recomendamos que procures consulta presencial nos teus cuidados primários ou liga ao SNS 24 (808 24 24 24). Se for uma situação urgente, liga 112.';
    const content = args.extraNote?.trim()
      ? `${baseMsg}\n\nNota do profissional: ${args.extraNote.trim()}`
      : baseMsg;
    const now = Date.now();

    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content,
      messageType: 'system',
    });
    await ctx.db.patch(args.id, { lastMessageAt: now });

    if (args.alsoClose) {
      await ctx.db.patch(args.id, {
        status: 'closed',
        closureReason: 'redirected-to-in-person',
        lastMessageAt: now,
      });
      await ctx.db.insert('auditLog', {
        conversationId: args.id,
        professionalId: userId,
        action: 'closure',
        details: 'Encerrada com encaminhamento para presencial',
      });
      // Trigger AI summary as the close mutation would have.
      await ctx.scheduler.runAfter(
        0,
        internal.ai.chatSummary.generateOnClose,
        { conversationId: args.id, triggeredBy: userId }
      );
    }

    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'redirect-recommended',
      details: args.extraNote?.trim() ?? '',
    });
  },
});

// Patient requests human handoff on an ai-only conversation. Flips it to
// 'human-async' and the conversation enters the queue like any other.
export const requestAiHandoff = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.patientId !== userId) throw new Error('Unauthorized');
    if (conv.kind !== 'ai-only') return; // already a normal conversation
    await ctx.db.patch(args.id, {
      kind: 'human-async',
      status: 'waiting',
      aiHandoffRequestedAt: Date.now(),
      lastMessageAt: Date.now(),
    });
    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content:
        'O utente pediu acompanhamento por um profissional. Esta conversa transitou da modalidade AI-only para fila de profissionais.',
      messageType: 'system',
    });
  },
});
