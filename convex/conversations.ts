import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import {
  calculateRiskLevel,
  priorityFromRisk,
  type RiskAssessment,
} from './lib/risk';

const topic = v.union(
  v.literal('contraception'),
  v.literal('pregnancy'),
  v.literal('sti'),
  v.literal('menstrual-cycle'),
  v.literal('general')
);

const status = v.union(
  v.literal('waiting'),
  v.literal('active'),
  v.literal('escalated'),
  v.literal('closed')
);

const escalationLevel = v.union(
  v.literal('routine'),
  v.literal('urgent'),
  v.literal('same-day'),
  v.literal('emergency')
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
    return ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', userId))
      .order('desc')
      .collect();
  },
});

export const listForProfessional = query({
  args: {
    status: v.optional(status),
    scope: v.optional(
      v.union(v.literal('all'), v.literal('mine'), v.literal('unassigned'))
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

    if (args.scope === 'mine') {
      conversations = conversations.filter((c) => c.professionalId === userId);
    } else if (args.scope === 'unassigned') {
      conversations = conversations.filter((c) => !c.professionalId);
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
    const all = await ctx.db.query('conversations').collect();
    return {
      mine: all.filter((c) => c.professionalId === userId && c.status !== 'closed').length,
      unassigned: all.filter((c) => !c.professionalId && c.status === 'waiting').length,
      escalated: all.filter((c) => c.status === 'escalated').length,
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
    const conversationId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: args.topic,
      title: args.title,
      priority,
      status: 'waiting',
      lastMessageAt: Date.now(),
      riskLevel,
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
    if (conv.professionalId && conv.professionalId !== userId) {
      throw new Error('Conversa já atribuída a outro profissional');
    }
    await ctx.db.patch(args.id, {
      professionalId: userId,
      status: conv.status === 'closed' ? conv.status : 'active',
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'assigned',
      details: 'Conversa atribuída ao profissional',
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

export const escalate = mutation({
  args: {
    id: v.id('conversations'),
    level: escalationLevel,
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    await requireProfessional(ctx, userId);
    if (!args.notes.trim()) throw new Error('Notas obrigatórias');
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: 'escalated',
      priority: 'urgent',
      escalationLevel: args.level,
      escalationNotes: args.notes,
      lastMessageAt: now,
    });
    await ctx.db.insert('messages', {
      conversationId: args.id,
      senderId: userId,
      content:
        'A tua conversa foi escalada e tem agora prioridade urgente. Em breve receberás resposta.',
      messageType: 'system',
    });
    await ctx.db.insert('auditLog', {
      conversationId: args.id,
      professionalId: userId,
      action: 'escalation',
      details: `[${args.level}] ${args.notes}`,
    });
  },
});
