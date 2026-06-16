// Patient-facing AI assistant. Composed of:
//   1. planner (purpose 'chat')         — drafts a response (streamed live).
//   2. safety + clinical validators      — run in parallel, return JSON.
//   3. judge                             — decides send|block based on validators.
//
// This topology is mirrored declaratively in registry.ts (AI_PIPELINES) so the
// admin diagram can render it. Keep the two in sync when changing the chain.
//
// Each step is a separate runAgent call linked via parentInvocationId so the
// audit tree reconstructs the chain. A placeholder ai-response message is
// created immediately (streaming: true) and patched live as tokens arrive;
// it is finalized (streaming: false) with the draft+disclaimer on approval,
// the fixed forwarding text on block, or a fallback on error.

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from '../_generated/server';
import { v } from 'convex/values';
import { z } from 'zod';
import { internal } from '../_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { runAgent } from './runAgent';
import type { Id } from '../_generated/dataModel';

const validatorSchema = z.object({
  decision: z.enum(['approve', 'block']),
  reason: z.string(),
});

const judgeSchema = z.object({
  action: z.enum(['send', 'block']),
  finalAnswer: z.string(),
});

const DISCLAIMER =
  '\n\n— Assistente AI. Esta resposta é informativa, não substitui consulta clínica.';
const FALLBACK_MESSAGE =
  'Não consegui responder agora. Tenta novamente daqui a pouco ou fala com um profissional.';
const BLOCKED_AUTO =
  'Esta pergunta merece resposta de um profissional. Toca em "Falar com profissional" para entrar na fila.';
const BLOCKED_RESPOND =
  'A tua pergunta foi encaminhada para a equipa clínica. Vais receber resposta de um profissional.';

type StreamVars = {
  query: string;
  conversationHistory: string;
  patientProfile: string;
  recentSummary: string;
  topicAndRisk: string;
};

// Shared: create a placeholder ai-response message, stream the draft into it,
// run the safety chain, then finalize (draft+disclaimer / blocked / fallback).
async function streamAndValidate(
  ctx: ActionCtx,
  args: {
    conversationId: Id<'conversations'>;
    patientId: Id<'users'>;
    baseVars: StreamVars;
    topic?: string;
    blockedMessage: string;
  }
): Promise<{ sent: boolean }> {
  const messageId = await ctx.runMutation(
    internal.ai.assistant.createAssistantPlaceholder,
    { conversationId: args.conversationId, patientId: args.patientId }
  );
  try {
    let lastWriteAt = 0;
    let lastLen = 0;
    const draft = await runAgent(ctx, {
      purpose: 'chat',
      topic: args.topic as any,
      vars: args.baseVars,
      userId: args.patientId,
      conversationId: args.conversationId,
      onDelta: async (textSoFar) => {
        const now = Date.now();
        if (now - lastWriteAt >= 150 || textSoFar.length - lastLen >= 24) {
          lastWriteAt = now;
          lastLen = textSoFar.length;
          await ctx.runMutation(internal.ai.assistant.patchStreamingMessage, {
            messageId,
            content: textSoFar,
          });
        }
      },
    });

    const [safety, clinical] = await Promise.all([
      runAgent(ctx, {
        purpose: 'chat-validator-safety',
        topic: args.topic as any,
        vars: { ...args.baseVars, draft: draft.output },
        userId: args.patientId,
        conversationId: args.conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
      runAgent(ctx, {
        purpose: 'chat-validator-clinical',
        topic: args.topic as any,
        vars: { ...args.baseVars, draft: draft.output },
        userId: args.patientId,
        conversationId: args.conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
    ]);

    const judged = await runAgent(ctx, {
      purpose: 'chat-judge',
      topic: args.topic as any,
      vars: {
        ...args.baseVars,
        draft: draft.output,
        safety: JSON.stringify(safety.output),
        clinical: JSON.stringify(clinical.output),
      },
      userId: args.patientId,
      conversationId: args.conversationId,
      parentInvocationId: draft.invocationId,
      outputSchema: judgeSchema,
    });

    const sent = judged.output.action === 'send';
    await ctx.runMutation(internal.ai.assistant.finalizeAssistantMessage, {
      messageId,
      content: sent ? draft.output + DISCLAIMER : args.blockedMessage,
      invocationId: judged.invocationId,
    });
    return { sent };
  } catch (e) {
    console.warn(
      `[assistant.streamAndValidate] failed: ${e instanceof Error ? e.message : String(e)}`
    );
    await ctx.runMutation(internal.ai.assistant.finalizeAssistantMessage, {
      messageId,
      content: FALLBACK_MESSAGE,
    });
    return { sent: false };
  }
}

export const createAssistantPlaceholder = internalMutation({
  args: { conversationId: v.id('conversations'), patientId: v.id('users') },
  handler: async (ctx, { conversationId, patientId }) => {
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      senderId: patientId,
      content: '',
      messageType: 'ai-response',
      streaming: true,
    });
    await ctx.db.patch(conversationId, { lastMessageAt: Date.now() });
    return messageId;
  },
});

export const patchStreamingMessage = internalMutation({
  args: { messageId: v.id('messages'), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    await ctx.db.patch(messageId, { content });
  },
});

export const finalizeAssistantMessage = internalMutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
    invocationId: v.optional(v.id('aiInvocations')),
  },
  handler: async (ctx, { messageId, content, invocationId }) => {
    await ctx.db.patch(messageId, {
      content,
      streaming: false,
      ...(invocationId ? { aiInvocationId: invocationId } : {}),
    });
  },
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
    const owner = await ctx.runQuery(internal.ai.assistant.getConversationPatient, {
      conversationId,
    });
    if (!owner) return;
    const ctxData = await ctx.runQuery(internal.ai.assistant.gatherContext, {
      conversationId,
      userId: owner,
    });
    if (!ctxData.allowed) return;
    await streamAndValidate(ctx, {
      conversationId,
      patientId: owner,
      baseVars: {
        query,
        conversationHistory: ctxData.conversationHistory,
        patientProfile: ctxData.patientProfile,
        recentSummary: ctxData.recentSummary,
        topicAndRisk: ctxData.topicAndRisk,
      },
      topic: ctxData.topic,
      blockedMessage: BLOCKED_AUTO,
    });
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
  handler: async (ctx, { conversationId, query }): Promise<{ sent: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const ctxData = await ctx.runQuery(internal.ai.assistant.gatherContext, {
      conversationId,
      userId,
    });
    if (!ctxData.allowed) {
      throw new Error('Only the patient on this conversation can ask the AI');
    }
    return streamAndValidate(ctx, {
      conversationId,
      patientId: userId,
      baseVars: {
        query,
        conversationHistory: ctxData.conversationHistory,
        patientProfile: ctxData.patientProfile,
        recentSummary: ctxData.recentSummary,
        topicAndRisk: ctxData.topicAndRisk,
      },
      topic: ctxData.topic,
      blockedMessage: BLOCKED_RESPOND,
    });
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
    const goalLabel = conv.wellbeingGoal ? ` · Objetivo: ${conv.wellbeingGoal}` : '';
    const topicAndRisk = `Tópico: ${conv.topic}${riskLabel}${goalLabel}`;

    return {
      allowed: true as const,
      topic: conv.topic,
      conversationHistory,
      patientProfile,
      recentSummary,
      topicAndRisk,
    };
  },
});
