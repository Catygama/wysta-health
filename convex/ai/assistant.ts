// Patient-facing AI assistant. Composed of:
//   1. planner (purpose 'chat')         — drafts a response.
//   2. safety + clinical validators      — run in parallel, return JSON.
//   3. judge                             — decides send|block based on validators.
//
// Each step is a separate runAgent call linked via parentInvocationId so the
// audit tree reconstructs the chain. The assistant message is persisted in
// `messages` with messageType='ai-response' and aiInvocationId pointing to
// the judge's invocation. If the judge blocks, a system message is posted
// indicating the question was forwarded to a professional.

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from '../_generated/server';
import { v } from 'convex/values';
import { z } from 'zod';
import { internal } from '../_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { runAgent } from './runAgent';

const validatorSchema = z.object({
  decision: z.enum(['approve', 'block']),
  reason: z.string(),
});

const judgeSchema = z.object({
  action: z.enum(['send', 'block']),
  finalAnswer: z.string(),
});

// Anonymous variant: no conversationId, no message rows are persisted.
// The chain still runs (so safety/clinical validators apply) and the audit
// row still lands in aiInvocations *with* userId so the cost cap and abuse
// controls remain effective. The audit row never carries inputText/outputText
// (per the existing data-minimisation contract), so even the audit reveals
// nothing about *what* was asked.
export const respondAnonymous = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<{
    sent: boolean;
    answer: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const profile = await ctx.runQuery(internal.ai.assistant.gatherProfileOnly, {
      userId,
    });

    const baseVars = {
      query,
      conversationHistory: 'Pergunta anónima — sem conversa associada.',
      patientProfile: profile.patientProfile,
      recentSummary: profile.recentSummary,
      topicAndRisk: 'Anónimo (sem conversa)',
    };

    const draft = await runAgent(ctx, {
      purpose: 'chat',
      vars: baseVars,
      userId,
    });
    const [safety, clinical] = await Promise.all([
      runAgent(ctx, {
        purpose: 'chat-validator-safety',
        vars: { ...baseVars, draft: draft.output },
        userId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
      runAgent(ctx, {
        purpose: 'chat-validator-clinical',
        vars: { ...baseVars, draft: draft.output },
        userId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
    ]);
    const judged = await runAgent(ctx, {
      purpose: 'chat-judge',
      vars: {
        ...baseVars,
        draft: draft.output,
        safety: JSON.stringify(safety.output),
        clinical: JSON.stringify(clinical.output),
      },
      userId,
      parentInvocationId: draft.invocationId,
      outputSchema: judgeSchema,
    });

    const sent = judged.output.action === 'send';
    const answer = sent
      ? judged.output.finalAnswer +
        '\n\n— Assistente AI. Pergunta anónima — não guardada no teu histórico.'
      : 'Esta pergunta não foi enviada por ser de natureza clínica que requer profissional. Para acompanhamento, abre uma conversa normal — esta resposta não foi guardada.';

    return { sent, answer };
  },
});

// Background trigger from messages.send when the patient writes in an
// ai-only conversation. Re-runs the same chain as `respond` and persists
// the answer as a new ai-response message. Tolerates failures so a bad
// LLM call doesn't break the patient's own message which already landed.
export const respondAuto = internalAction({
  args: {
    conversationId: v.id('conversations'),
    query: v.string(),
  },
  handler: async (ctx, { conversationId, query }) => {
    try {
      const owner = await ctx.runQuery(internal.ai.assistant.getConversationPatient, {
        conversationId,
      });
      if (!owner) return;

      const ctxData = await ctx.runQuery(internal.ai.assistant.gatherContext, {
        conversationId,
        userId: owner,
      });
      if (!ctxData.allowed) return;

      const baseVars = {
        query,
        conversationHistory: ctxData.conversationHistory,
        patientProfile: ctxData.patientProfile,
        recentSummary: ctxData.recentSummary,
        topicAndRisk: ctxData.topicAndRisk,
      };

      const draft = await runAgent(ctx, {
        purpose: 'chat',
        vars: baseVars,
        userId: owner,
        conversationId,
      });
      const [safety, clinical] = await Promise.all([
        runAgent(ctx, {
          purpose: 'chat-validator-safety',
          vars: { ...baseVars, draft: draft.output },
          userId: owner,
          conversationId,
          parentInvocationId: draft.invocationId,
          outputSchema: validatorSchema,
        }),
        runAgent(ctx, {
          purpose: 'chat-validator-clinical',
          vars: { ...baseVars, draft: draft.output },
          userId: owner,
          conversationId,
          parentInvocationId: draft.invocationId,
          outputSchema: validatorSchema,
        }),
      ]);
      const judged = await runAgent(ctx, {
        purpose: 'chat-judge',
        vars: {
          ...baseVars,
          draft: draft.output,
          safety: JSON.stringify(safety.output),
          clinical: JSON.stringify(clinical.output),
        },
        userId: owner,
        conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: judgeSchema,
      });

      const sent = judged.output.action === 'send';
      const answer = sent
        ? judged.output.finalAnswer
        : 'Esta pergunta merece resposta de uma profissional. Toca em "Falar com profissional" para entrar na fila.';
      await ctx.runMutation(internal.ai.assistant.recordAssistantMessage, {
        conversationId,
        patientId: owner,
        content: answer,
        sent,
        invocationId: judged.invocationId,
      });
    } catch (e) {
      console.warn(
        `[assistant.respondAuto] failed for ${conversationId}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  },
});

export const getConversationPatient = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    return conv?.patientId ?? null;
  },
});

export const gatherProfileOnly = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const lines: string[] = [];
    if (profile?.ageRange) lines.push(`Faixa etária: ${profile.ageRange}`);
    if (profile?.pregnancyStatus) lines.push(`Gravidez: ${profile.pregnancyStatus}`);
    if (profile?.conditions?.length) lines.push(`Condições: ${profile.conditions.join(', ')}`);
    if (profile?.medications?.length) lines.push(`Medicação: ${profile.medications.join(', ')}`);
    return {
      patientProfile:
        lines.length > 0 ? lines.join('\n') : 'Sem dados clínicos estruturados registados.',
      recentSummary: profile?.aiSummary ?? 'Sem histórico clínico.',
    };
  },
});

export const respond = action({
  args: {
    conversationId: v.id('conversations'),
    query: v.string(),
  },
  handler: async (ctx, { conversationId, query }): Promise<{
    sent: boolean;
    answer: string;
    invocationId: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const ctxData = await ctx.runQuery(internal.ai.assistant.gatherContext, {
      conversationId,
      userId,
    });
    if (!ctxData.allowed) {
      throw new Error('Only the patient on this conversation can ask the AI');
    }

    // Common context vars passed through every step of the chain. Same
    // shape so each prompt can reference whichever vars it cares about.
    const baseVars = {
      query,
      conversationHistory: ctxData.conversationHistory,
      patientProfile: ctxData.patientProfile,
      recentSummary: ctxData.recentSummary,
      topicAndRisk: ctxData.topicAndRisk,
    };

    // Step 1: draft
    const draft = await runAgent(ctx, {
      purpose: 'chat',
      vars: baseVars,
      userId,
      conversationId,
    });

    // Step 2: parallel validators
    const [safety, clinical] = await Promise.all([
      runAgent(ctx, {
        purpose: 'chat-validator-safety',
        vars: { ...baseVars, draft: draft.output },
        userId,
        conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
      runAgent(ctx, {
        purpose: 'chat-validator-clinical',
        vars: { ...baseVars, draft: draft.output },
        userId,
        conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
    ]);

    // Step 3: judge
    const judged = await runAgent(ctx, {
      purpose: 'chat-judge',
      vars: {
        ...baseVars,
        draft: draft.output,
        safety: JSON.stringify(safety.output),
        clinical: JSON.stringify(clinical.output),
      },
      userId,
      conversationId,
      parentInvocationId: draft.invocationId,
      outputSchema: judgeSchema,
    });

    const sent = judged.output.action === 'send';
    const answer = sent
      ? judged.output.finalAnswer
      : 'A tua pergunta foi encaminhada para a equipa clínica. Vais receber resposta de uma profissional.';

    await ctx.runMutation(internal.ai.assistant.recordAssistantMessage, {
      conversationId,
      patientId: userId,
      content: answer,
      sent,
      invocationId: judged.invocationId,
    });

    return { sent, answer, invocationId: judged.invocationId };
  },
});

// Returns access flag plus *sanitized* clinical context for the chain.
// Strips PII (name, email, address) — only clinical fields and conversation
// content reach the LLM. The conversation messages stay PII-as-typed since
// the patient herself wrote them.
export const gatherContext = internalQuery({
  args: { conversationId: v.id('conversations'), userId: v.id('users') },
  handler: async (ctx, { conversationId, userId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return { allowed: false as const };
    if (conv.patientId !== userId) return { allowed: false as const };
    if (conv.status === 'closed') return { allowed: false as const };

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(20);

    // Reverse to chronological + filter internals/system but keep ai-response
    // (the assistant's own previous answers in this conversation are useful
    // context — don't repeat / contradict yourself).
    const visible = messages.reverse().filter(
      (m) => !m.isInternal && m.messageType !== 'system' && m.messageType !== 'triage-response'
    );
    const conversationHistory =
      visible.length > 0
        ? visible
            .map((m) => {
              const role =
                m.messageType === 'ai-response'
                  ? 'AI (anterior)'
                  : m.senderId === conv.patientId
                    ? 'Utente'
                    : 'Profissional';
              return `${role}: ${m.content}`;
            })
            .join('\n')
        : 'Sem histórico de mensagens.';

    const triageMsg = messages.find((m) => m.metadata?.triageData);
    const triageData = triageMsg?.metadata?.triageData;

    const profileLines: string[] = [];
    if (profile?.ageRange) profileLines.push(`Faixa etária: ${profile.ageRange}`);
    if (profile?.pregnancyStatus)
      profileLines.push(`Gravidez: ${profile.pregnancyStatus}`);
    if (profile?.conditions?.length)
      profileLines.push(`Condições: ${profile.conditions.join(', ')}`);
    if (profile?.medications?.length)
      profileLines.push(`Medicação: ${profile.medications.join(', ')}`);
    if (triageData?.riskLevel)
      profileLines.push(`Triagem mais recente: risco ${triageData.riskLevel}`);
    const patientProfile =
      profileLines.length > 0
        ? profileLines.join('\n')
        : 'Sem dados clínicos estruturados registados.';

    const recentSummary = profile?.aiSummary ?? 'Sem histórico clínico.';

    const riskLabel = conv.riskLevel ? ` (risco ${conv.riskLevel})` : '';
    const topicAndRisk = `Tópico: ${conv.topic}${riskLabel}`;

    return {
      allowed: true as const,
      conversationHistory,
      patientProfile,
      recentSummary,
      topicAndRisk,
    };
  },
});

export const recordAssistantMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    patientId: v.id('users'),
    content: v.string(),
    sent: v.boolean(),
    invocationId: v.id('aiInvocations'),
  },
  handler: async (ctx, args) => {
    const disclaimer = args.sent
      ? '\n\n— Assistente AI. Esta resposta é informativa, não substitui consulta clínica.'
      : '';
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: args.patientId,
      content: args.content + disclaimer,
      messageType: 'ai-response',
      aiInvocationId: args.invocationId,
    });
    await ctx.db.patch(args.conversationId, { lastMessageAt: Date.now() });
  },
});
