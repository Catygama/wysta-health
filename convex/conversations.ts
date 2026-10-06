import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
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

    // The queue only lists open conversations (closed ones live in the
    // professional's Histórico), and hides ai-only conversations unless the
    // patient has requested human handoff.
    conversations = conversations.filter(
      (c) => c.status !== 'closed' && (c.kind !== 'ai-only' || c.aiHandoffRequestedAt)
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
    const related = async (relatedId?: Id<'conversations'>) => {
      if (!relatedId) return null;
      const other = await ctx.db.get(relatedId);
      if (!other) return null;
      return { _id: other._id, kind: other.kind ?? 'human-async', status: other.status };
    };
    return {
      ...conv,
      patient: patientPayload,
      contextConversation: await related(conv.contextConversationId),
      counterpartConversation: await related(conv.counterpartConversationId),
    };
  },
});

// A patient keeps at most one open professional conversation per topic.
async function findOpenProfessionalConversation(
  ctx: QueryCtx,
  patientId: Id<'users'>,
  topicId: string
): Promise<Doc<'conversations'> | null> {
  for await (const c of ctx.db
    .query('conversations')
    .withIndex('by_patient', (q) => q.eq('patientId', patientId))
    .order('desc')) {
    if (c.topic === topicId && c.status !== 'closed' && c.kind !== 'ai-only') return c;
  }
  return null;
}

// Topic → open professional conversation, so Home can send the patient back
// to it instead of starting a second one.
export const openProfessionalByTopic = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {};
    const byTopic: Record<string, Id<'conversations'>> = {};
    for await (const c of ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', userId))
      .order('desc')) {
      if (c.status !== 'closed' && c.kind !== 'ai-only' && !byTopic[c.topic]) {
        byTopic[c.topic] = c._id;
      }
    }
    return byTopic;
  },
});

export const create = mutation({
  args: {
    topic,
    title: v.string(),
    wellbeingGoal: v.optional(v.string()),
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

    const kind = args.kind ?? 'human-async';
    if (kind === 'human-async') {
      const existing = await findOpenProfessionalConversation(ctx, userId, args.topic);
      if (existing) return existing._id;
    }

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
      wellbeingGoal: args.wellbeingGoal,
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
    // Taking an AI chat means the professional is intervening: it becomes
    // the professional conversation (and supersedes the previous one).
    if (conv.kind === 'ai-only') {
      await convertAiToProfessional(ctx, conv, {
        professionalId: userId,
        reason: 'professional-joined',
      });
      await ctx.db.insert('auditLog', {
        conversationId: args.id,
        professionalId: userId,
        action: 'assigned',
        details: 'Profissional interveio na conversa com AI',
      });
      return;
    }
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

// Ends a conversation. Either the patient who owns it or a professional can
// close it; it then leaves the open lists and shows up in their "Histórico".
export const close = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    const byPatient = conv.patientId === userId;
    if (!byPatient) await requireProfessional(ctx, userId);
    if (conv.status === 'closed') return;
    const now = Date.now();
    await ctx.db.patch(args.id, { status: 'closed', closureReason: 'resolved', lastMessageAt: now });
    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content: byPatient
        ? 'Conversa terminada pela utente.'
        : 'Conversa encerrada pelo profissional de saúde.',
      messageType: 'system',
    });
    // auditLog rows are attributed to a professional; a patient closing a
    // conversation is recorded by the system message above.
    const professionalId = byPatient ? conv.professionalId : userId;
    if (!byPatient) {
      await ctx.db.insert('auditLog', {
        conversationId: args.id,
        professionalId: userId,
        action: 'closure',
        details: 'Conversa encerrada',
      });
    }
    // Schedule AI summary generation in the background (only meaningful
    // with a professional on the conversation). If config/prompt are missing
    // or generation fails, the close still succeeds.
    if (professionalId) {
      await ctx.scheduler.runAfter(
        0,
        internal.ai.chatSummary.generateOnClose,
        { conversationId: args.id, triggeredBy: professionalId }
      );
    }
  },
});

// Closed conversations for the "Histórico" screen: the patient's own, or the
// ones a professional was assigned to.
export const listHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isProfessional = profile?.role === 'professional' || profile?.role === 'admin';
    const rows = isProfessional
      ? await ctx.db
          .query('conversations')
          .withIndex('by_professional', (q) => q.eq('professionalId', userId))
          .order('desc')
          .take(300)
      : await ctx.db
          .query('conversations')
          .withIndex('by_patient', (q) => q.eq('patientId', userId))
          .order('desc')
          .take(300);
    return rows
      .filter((c) => c.status === 'closed')
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .map((c) => ({ ...c, isAiOnly: c.kind === 'ai-only' }));
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

// Patient toggles between talking to a professional and to the AI from the
// chat header. Returns the open counterpart conversation if there is one,
// otherwise creates it: a new conversation of the other kind that carries the
// current one as context (the AI reads its messages; professionals see it).
export const switchMode = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args): Promise<{ id: Id<'conversations'>; created: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const conv = await ctx.db.get(args.id);
    if (!conv) throw new Error('Conversation not found');
    if (conv.patientId !== userId) throw new Error('Unauthorized');
    if (conv.status === 'closed') throw new Error('Conversa fechada');

    const targetKind = conv.kind === 'ai-only' ? 'human-async' : 'ai-only';
    if (conv.counterpartConversationId) {
      const other = await ctx.db.get(conv.counterpartConversationId);
      if (
        other &&
        other.patientId === userId &&
        other.status !== 'closed' &&
        (other.kind ?? 'human-async') === targetKind
      ) {
        return { id: other._id, created: false };
      }
    }

    // Asking for a professional while one is already open on this topic: go
    // back to it (one open professional conversation per topic).
    if (targetKind === 'human-async') {
      const existing = await findOpenProfessionalConversation(ctx, userId, conv.topic);
      if (existing) {
        await ctx.db.patch(conv._id, { counterpartConversationId: existing._id });
        return { id: existing._id, created: false };
      }
    }

    const now = Date.now();
    const toAi = targetKind === 'ai-only';
    const newId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: conv.topic,
      title: toAi ? 'Conversa com AI' : 'Conversa com profissional',
      priority: conv.priority,
      status: toAi ? 'active' : 'waiting',
      lastMessageAt: now,
      riskLevel: conv.riskLevel,
      kind: targetKind,
      wellbeingGoal: conv.wellbeingGoal,
      contextConversationId: conv._id,
      counterpartConversationId: conv._id,
      ...(toAi ? {} : { aiHandoffRequestedAt: now }),
    });
    await ctx.db.patch(conv._id, { counterpartConversationId: newId });

    // Carry the triage answers over so the queue and the AI see them here too.
    const opening = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conv._id))
      .take(5);
    const triage = opening.find((m) => m.metadata?.triageData);
    if (triage) {
      await ctx.db.insert('messages', {
        conversationId: newId,
        senderId: userId,
        content: triage.content,
        messageType: 'triage-response',
        metadata: { triageData: triage.metadata!.triageData },
      });
    }
    await ctx.db.insert('messages', {
      conversationId: newId,
      senderId: userId,
      content: toAi
        ? 'Conversa com a assistente AI. A assistente tem acesso à tua conversa com o profissional.'
        : 'Pediste acompanhamento por um profissional. O profissional terá acesso à tua conversa com a assistente AI.',
      messageType: 'system',
    });
    return { id: newId, created: true };
  },
});

// Turns an ai-only conversation into the professional conversation. If the
// patient still has an open professional conversation paired with it, that
// one is closed and its professional (if any) carries over. Used when the AI
// escalates (judge blocks) or a professional intervenes in the AI chat.
export async function convertAiToProfessional(
  ctx: MutationCtx,
  aiConv: Doc<'conversations'>,
  opts: { professionalId?: Id<'users'>; reason: 'ai-escalated' | 'professional-joined' }
) {
  if (aiConv.kind !== 'ai-only' || aiConv.status === 'closed') return;
  const now = Date.now();

  let previous = aiConv.counterpartConversationId
    ? await ctx.db.get(aiConv.counterpartConversationId)
    : null;
  if (previous && (previous.status === 'closed' || previous.kind === 'ai-only')) {
    previous = null;
  }

  const professionalId = opts.professionalId ?? previous?.professionalId;
  const priority =
    previous && (PRIORITY_RANK[previous.priority] ?? 0) > (PRIORITY_RANK[aiConv.priority] ?? 0)
      ? previous.priority
      : aiConv.priority;

  await ctx.db.patch(aiConv._id, {
    kind: 'human-async',
    status: professionalId ? 'active' : 'waiting',
    professionalId,
    priority,
    aiHandoffRequestedAt: now,
    lastMessageAt: now,
    counterpartConversationId: undefined,
    // Keep the superseded professional conversation reachable as context.
    contextConversationId: aiConv.contextConversationId ?? previous?._id,
  });
  await ctx.db.insert('messages', {
    conversationId: aiConv._id,
    senderId: aiConv.patientId,
    content:
      opts.reason === 'professional-joined'
        ? 'Um profissional juntou-se a esta conversa e vai continuar a acompanhar-te aqui.'
        : 'A assistente encaminhou esta conversa para um profissional. Vais receber resposta aqui.',
    messageType: 'system',
  });

  if (previous) {
    await ctx.db.patch(previous._id, {
      status: 'closed',
      closureReason: 'continued-elsewhere',
      counterpartConversationId: undefined,
      lastMessageAt: now,
    });
    await ctx.db.insert('messages', {
      conversationId: previous._id,
      senderId: aiConv.patientId,
      content:
        'Esta conversa foi encerrada: o acompanhamento continua na tua conversa com a assistente, que passou para um profissional.',
      messageType: 'system',
    });
    if (previous.professionalId) {
      await ctx.db.insert('auditLog', {
        conversationId: previous._id,
        professionalId: previous.professionalId,
        action: 'closure',
        details: 'Encerrada: acompanhamento continua na conversa com AI convertida',
      });
    }
  }
}

// Called by the assistant when the judge blocks a draft in an ai-only chat
// that is paired with an open professional conversation.
export const escalateAiConversation = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return;
    await convertAiToProfessional(ctx, conv, { reason: 'ai-escalated' });
  },
});
