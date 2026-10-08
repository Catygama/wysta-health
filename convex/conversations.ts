import { internalMutation, mutation, query, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { getActiveUserId } from './lib/accounts';
import { v } from 'convex/values';
import { calculateRiskLevel, type RiskAssessment } from './lib/risk';
import { alertLevelFor, moreSevere, priorityFor, sortQueue, type AlertLevel } from './lib/alerts';
import { hasProfessionalAccess } from './lib/professional';
import { topicValidator as topic } from './lib/topics';
import { userError, NOT_AUTHENTICATED, NOT_ALLOWED } from './lib/errors';

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

export const listForPatient = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getActiveUserId(ctx);
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
        v.literal('unassigned')
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
    const userId = await getActiveUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!hasProfessionalAccess(profile)) return [];

    let conversations = args.status
      ? await ctx.db
          .query('conversations')
          .withIndex('by_status', (q) => q.eq('status', args.status as any))
          .collect()
      : await ctx.db.query('conversations').collect();

    // Only open professional conversations: closed ones live in the
    // professional's Histórico, and chats with the AI are never listed (a
    // professional reads them only inside the linked case, see aiContext).
    conversations = conversations.filter((c) => c.status !== 'closed' && c.kind !== 'ai-only');

    if (args.scope === 'mine') {
      conversations = conversations.filter((c) => c.professionalId === userId);
    } else if (args.scope === 'unassigned') {
      conversations = conversations.filter((c) => !c.professionalId);
    }

    if (args.priority) {
      conversations = conversations.filter((c) => c.priority === args.priority);
    }

    // For the list card: who the patient is, what was said last, and whether
    // the request came from a chat with the assistant.
    return Promise.all(
      sortQueue(conversations).map(async (c) => {
        const context = c.contextConversationId ? await ctx.db.get(c.contextConversationId) : null;
        const patientProfile = await ctx.db
          .query('userProfiles')
          .withIndex('by_user', (q) => q.eq('userId', c.patientId))
          .unique();
        const patientUser = await ctx.db.get(c.patientId);
        const recent = await ctx.db
          .query('messages')
          .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
          .order('desc')
          .take(10);
        const lastText = recent.find(
          (m) => !m.isInternal && (m.messageType === 'text' || m.messageType === 'ai-response')
        );
        return {
          ...c,
          fromAi: context?.kind === 'ai-only',
          patientName:
            patientProfile?.displayName?.trim() || patientUser?.email || 'Utente convidada',
          preview: lastText?.content.slice(0, 140) ?? null,
        };
      })
    );
  },
});

export const queueStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!hasProfessionalAccess(profile)) return null;
    const all = (await ctx.db.query('conversations').collect()).filter(
      (c) => c.kind !== 'ai-only'
    );
    return {
      mine: all.filter((c) => c.professionalId === userId && c.status !== 'closed').length,
      unassigned: all.filter((c) => !c.professionalId && c.status === 'waiting').length,
      urgent: all.filter((c) => c.priority === 'urgent' && c.status !== 'closed').length,
    };
  },
});

export const get = query({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) return null;
    const conv = await ctx.db.get(args.id);
    if (!conv) return null;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isProfessional = hasProfessionalAccess(profile);
    // The patient, or an admin / approved professional. A professional whose
    // account is pending or was rejected has no access, even if assigned.
    const hasAccess = conv.patientId === userId || isProfessional;
    if (!hasAccess) return null;
    if (
      conv.kind === 'ai-only' &&
      conv.patientId !== userId &&
      !(await professionalCanSeeAi(ctx, conv, userId))
    ) {
      return null;
    }
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

// A patient keeps at most one open conversation per topic and kind: one with
// a nurse and one with the AI.
async function findOpenConversation(
  ctx: QueryCtx,
  patientId: Id<'users'>,
  topicId: string,
  kind: 'human-async' | 'ai-only'
): Promise<Doc<'conversations'> | null> {
  for await (const c of ctx.db
    .query('conversations')
    .withIndex('by_patient', (q) => q.eq('patientId', patientId))
    .order('desc')) {
    if (c.topic === topicId && c.status !== 'closed' && (c.kind ?? 'human-async') === kind) return c;
  }
  return null;
}

export function findOpenProfessionalConversation(ctx: QueryCtx, patientId: Id<'users'>, topicId: string) {
  return findOpenConversation(ctx, patientId, topicId, 'human-async');
}

// Topic → open conversation of one kind, so Home can send the patient back to it.
async function openByTopic(ctx: QueryCtx, kind: 'human-async' | 'ai-only') {
  const userId = await getActiveUserId(ctx);
  if (!userId) return {};
  const byTopic: Record<string, Id<'conversations'>> = {};
  for await (const c of ctx.db
    .query('conversations')
    .withIndex('by_patient', (q) => q.eq('patientId', userId))
    .order('desc')) {
    if (c.status !== 'closed' && (c.kind ?? 'human-async') === kind && !byTopic[c.topic]) {
      byTopic[c.topic] = c._id;
    }
  }
  return byTopic;
}

// Topic → open professional conversation, so Home can send the patient back
// to it instead of starting a second one.
export const openProfessionalByTopic = query({
  args: {},
  handler: (ctx) => openByTopic(ctx, 'human-async'),
});

// Same for the AI: one open AI chat per topic.
export const openAiByTopic = query({
  args: {},
  handler: (ctx) => openByTopic(ctx, 'ai-only'),
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
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);

    // Already one open conversation of this kind on the topic: reuse it.
    const kind = args.kind ?? 'human-async';
    const existing = await findOpenConversation(ctx, userId, args.topic, kind);
    if (existing) return existing._id;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let alertLevel: AlertLevel | undefined;
    if (args.triageData) {
      const triage = await ctx.db
        .query('triageQuestions')
        .withIndex('by_topic', (q) => q.eq('topic', args.topic))
        .unique();
      riskLevel = calculateRiskLevel(
        args.triageData.responses,
        triage?.riskAssessment as RiskAssessment | undefined
      );
      // Recomputed here from the stored questions rather than trusted from the client.
      alertLevel = alertLevelFor(triage?.questions ?? [], args.triageData.responses);
    }

    const priority = priorityFor(alertLevel, riskLevel);
    const conversationId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: args.topic,
      title: args.title,
      priority,
      // ai-only conversations skip the queue and go straight to active.
      status: kind === 'ai-only' ? 'active' : 'waiting',
      lastMessageAt: Date.now(),
      riskLevel,
      alertLevel,
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
            alertLevel,
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
  // Admins, and professionals an admin has approved (lib/professional.ts).
  if (!hasProfessionalAccess(profile)) {
    throw userError(NOT_ALLOWED);
  }
  return profile;
}

export const assign = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw userError('Esta conversa já não existe.');
    if (conv.status === 'closed') {
      throw userError('Esta conversa está encerrada e não pode ser atribuída.');
    }
    if (conv.professionalId === userId) return; // already mine, no-op
    // Chats with the AI are read-only context for professionals.
    if (conv.kind === 'ai-only') {
      throw userError('As conversas com a assistente IA não podem ser atribuídas.');
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
        ? 'Conversa reatribuída ao enfermeiro (take-over)'
        : 'Conversa atribuída ao enfermeiro',
    });
  },
});

export const unassign = mutation({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw userError('Esta conversa já não existe.');
    if (conv.professionalId !== userId) throw userError('Esta conversa não está atribuída a ti.');
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
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw userError('Esta conversa já não existe.');
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
        : 'Conversa encerrada pelo enfermeiro.',
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
    const userId = await getActiveUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isProfessional = hasProfessionalAccess(profile);
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
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw userError('Esta conversa já não existe.');
    if (conv.status === 'closed') {
      throw userError('Esta conversa está encerrada. Não é possível alterar a prioridade.');
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

// Sends a templated message to the patient recommending in-person care.
// Optionally closes the conversation with closureReason='redirected-to-in-person'.
export const recommendInPerson = mutation({
  args: {
    id: v.id('conversations'),
    alsoClose: v.optional(v.boolean()),
    extraNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const senderProfile = await requireProfessional(ctx, userId);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw userError('Esta conversa já não existe.');
    if (conv.status === 'closed') throw userError('Esta conversa já está encerrada.');

    const baseMsg =
      'Pelo que descreves, recomendamos que procures consulta presencial nos teus cuidados primários ou liga ao SNS 24 (808 24 24 24). Se for uma situação urgente, liga 112.';
    // The professional's own words follow the recommendation as one message.
    const content = args.extraNote?.trim() ? `${baseMsg}\n\n${args.extraNote.trim()}` : baseMsg;
    const now = Date.now();

    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content,
      // A regular message from the professional (their bubble), not a system line.
      messageType: 'text',
    });
    await ctx.db.patch(args.id, { lastMessageAt: now });
    // Same push as any professional message; never the content (lock screens).
    const senderName = senderProfile?.displayName?.trim();
    await ctx.scheduler.runAfter(0, internal.notifications.sendToUser, {
      userId: conv.patientId,
      title: senderName ? `Nova mensagem de ${senderName}` : 'Nova mensagem de um enfermeiro',
      data: { conversationId: args.id },
    });

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
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const conv = await ctx.db.get(args.id);
    if (!conv) throw userError('Esta conversa já não existe.');
    if (conv.patientId !== userId) throw userError(NOT_ALLOWED);
    if (conv.status === 'closed') throw userError('Esta conversa está encerrada.');

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

    // One of the other kind is already open on this topic: go back to it
    // (one open conversation per topic with a nurse, one with the AI).
    const existing = await findOpenConversation(ctx, userId, conv.topic, targetKind);
    if (existing) {
      await ctx.db.patch(conv._id, { counterpartConversationId: existing._id });
      if (!existing.counterpartConversationId) {
        await ctx.db.patch(existing._id, { counterpartConversationId: conv._id });
      }
      return { id: existing._id, created: false };
    }

    const now = Date.now();
    const toAi = targetKind === 'ai-only';
    const newId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: conv.topic,
      title: toAi ? 'Conversa com AI' : 'Conversa com enfermeiro',
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
        ? 'Conversa com a assistente AI. A assistente tem acesso à tua conversa com o enfermeiro.'
        : 'Pediste acompanhamento por um enfermeiro. O enfermeiro terá acesso à tua conversa com a assistente AI.',
      messageType: 'system',
    });
    return { id: newId, created: true };
  },
});

// Called by the assistant when the judge blocks a draft in an ai-only chat
// that is paired with an open professional conversation: the question goes to
// that professional conversation (raised to at least high priority). The AI
// chat stays as it is; the professional reads it at the top of the case.
export const escalateAiConversation = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const aiConv = await ctx.db.get(conversationId);
    if (!aiConv || aiConv.kind !== 'ai-only' || !aiConv.counterpartConversationId) return;
    const pro = await ctx.db.get(aiConv.counterpartConversationId);
    if (!pro || pro.status === 'closed' || pro.kind === 'ai-only') return;
    const now = Date.now();
    await ctx.db.patch(pro._id, {
      priority: (PRIORITY_RANK[pro.priority] ?? 0) < PRIORITY_RANK.high ? 'high' : pro.priority,
      lastMessageAt: now,
    });
    await ctx.db.insert('messages', {
      conversationId: pro._id,
      senderId: pro.patientId,
      content: 'A tua pergunta à assistente IA foi encaminhada para o enfermeiro.',
      messageType: 'system',
    });
  },
});

// A safety rule matched the patient's message to the AI (lib/aiSafetyMessages):
// the conversation becomes urgent with the rule's alert level, and a linked
// open conversation with a nurse is raised the same way and told why.
export const flagSafetyRule = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    alertLevel: v.union(v.literal('emergency'), v.literal('urgent')),
    label: v.string(),
  },
  handler: async (ctx, { conversationId, alertLevel, label }) => {
    const raise = async (id: Id<'conversations'>) => {
      const conv = await ctx.db.get(id);
      if (!conv || conv.status === 'closed') return null;
      await ctx.db.patch(id, {
        priority: 'urgent',
        alertLevel: conv.alertLevel ? moreSevere(conv.alertLevel, alertLevel) : alertLevel,
        lastMessageAt: Date.now(),
      });
      return conv;
    };
    const aiConv = await raise(conversationId);
    if (!aiConv) return;
    await ctx.db.insert('auditLog', {
      conversationId,
      action: 'priority-change',
      details: `Deteção automática na conversa com a IA: ${label}.`,
    });
    for (const linkedId of [aiConv.counterpartConversationId, aiConv.contextConversationId]) {
      if (!linkedId) continue;
      const linked = await ctx.db.get(linkedId);
      if (!linked || linked.kind === 'ai-only') continue;
      if (!(await raise(linkedId))) continue;
      await ctx.db.insert('messages', {
        conversationId: linkedId,
        senderId: linked.patientId,
        content: 'A tua mensagem à assistente IA indica uma situação urgente e foi encaminhada para o enfermeiro.',
        messageType: 'system',
      });
      await ctx.db.insert('auditLog', {
        conversationId: linkedId,
        action: 'escalation',
        details: `Deteção automática na conversa com a IA: ${label}.`,
      });
    }
  },
});

// A professional may read a patient's AI chat only through a professional
// conversation linked to it (AI first then a professional, or an AI side chat
// opened while waiting) that is assigned to them, or still unassigned in the
// queue (so whoever picks the request up can read it). Nobody else.
export async function professionalCanSeeAi(
  ctx: QueryCtx,
  aiConv: Doc<'conversations'>,
  userId: Id<'users'>
): Promise<boolean> {
  for (const linkedId of [aiConv.contextConversationId, aiConv.counterpartConversationId]) {
    if (!linkedId) continue;
    const linked = await ctx.db.get(linkedId);
    if (!linked || linked.kind === 'ai-only') continue;
    if (linked.professionalId === userId) return true;
    if (!linked.professionalId && linked.status !== 'closed') return true;
  }
  return false;
}

// The patient's chats with the AI linked to a professional conversation, for
// the collapsible block at the top of the case: 'before' = started with the AI
// and then asked for a professional; 'during' = opened while waiting.
export const aiContext = query({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!hasProfessionalAccess(profile)) return [];
    const conv = await ctx.db.get(args.id);
    if (!conv || conv.kind === 'ai-only') return [];
    if (conv.professionalId && conv.professionalId !== userId) return [];

    const seen = new Set<string>();
    const out = [];
    for (const linkedId of [conv.contextConversationId, conv.counterpartConversationId]) {
      if (!linkedId || seen.has(linkedId)) continue;
      seen.add(linkedId);
      const ai = await ctx.db.get(linkedId);
      if (!ai || ai.kind !== 'ai-only') continue;
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', ai._id))
        .take(200);
      out.push({
        conversationId: ai._id,
        relation: ai._creationTime < conv._creationTime ? ('before' as const) : ('during' as const),
        messages: messages
          .filter((m) => !m.isInternal && (m.messageType === 'text' || m.messageType === 'ai-response'))
          .map((m) => ({
            _id: m._id,
            fromPatient: m.senderId === ai.patientId && m.messageType === 'text',
            content: m.content,
            at: m._creationTime,
          })),
      });
    }
    return out;
  },
});
