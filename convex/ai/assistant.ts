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
import { SUGGEST_CLOSE_MARKER } from './defaults';
import type { Id } from '../_generated/dataModel';

// Removes the suggest-close marker from planner output — also a partial
// marker still arriving at the end of a stream — so the patient never sees it.
export function stripSuggestClose(text: string): { text: string; suggestClose: boolean } {
  const suggestClose = text.includes(SUGGEST_CLOSE_MARKER);
  let out = text.split(SUGGEST_CLOSE_MARKER).join('');
  for (let n = SUGGEST_CLOSE_MARKER.length - 1; n > 0; n--) {
    if (out.endsWith(SUGGEST_CLOSE_MARKER.slice(0, n))) {
      out = out.slice(0, -n);
      break;
    }
  }
  return { text: out.trimEnd(), suggestClose };
}

const validatorSchema = z.object({
  decision: z.enum(['approve', 'block']),
  reason: z.string(),
});

const judgeSchema = z.object({
  action: z.enum(['send', 'block']),
  finalAnswer: z.string(),
});

const FALLBACK_MESSAGE =
  'Não consegui responder agora. Tenta novamente daqui a pouco ou fala com um profissional.';
const BLOCKED_AUTO =
  'Esta pergunta merece resposta de um profissional. Toca em "Falar com profissional" para entrar na fila.';
const BLOCKED_RESPOND =
  'A tua pergunta foi encaminhada para a equipa clínica. Vais receber resposta de um profissional.';
const BLOCKED_ESCALATE =
  'Esta pergunta precisa de um profissional. Encaminhei-a para a tua conversa com o profissional, que te vai responder lá.';

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
): Promise<{ sent: boolean; blocked: boolean }> {
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
            content: stripSuggestClose(textSoFar).text,
          });
        }
      },
    });
    const { text: draftText, suggestClose } = stripSuggestClose(draft.output);

    const [safety, clinical] = await Promise.all([
      runAgent(ctx, {
        purpose: 'chat-validator-safety',
        topic: args.topic as any,
        vars: { ...args.baseVars, draft: draftText },
        userId: args.patientId,
        conversationId: args.conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
      runAgent(ctx, {
        purpose: 'chat-validator-clinical',
        topic: args.topic as any,
        vars: { ...args.baseVars, draft: draftText },
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
        draft: draftText,
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
      content: sent ? draftText : args.blockedMessage,
      suggestClose: sent && suggestClose,
      invocationId: judged.invocationId,
    });
    return { sent, blocked: !sent };
  } catch (e) {
    console.warn(
      `[assistant.streamAndValidate] failed: ${e instanceof Error ? e.message : String(e)}`
    );
    await ctx.runMutation(internal.ai.assistant.finalizeAssistantMessage, {
      messageId,
      content: FALLBACK_MESSAGE,
    });
    return { sent: false, blocked: false };
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
    suggestClose: v.optional(v.boolean()),
  },
  handler: async (ctx, { messageId, content, invocationId, suggestClose }) => {
    await ctx.db.patch(messageId, {
      content,
      streaming: false,
      ...(invocationId ? { aiInvocationId: invocationId } : {}),
      ...(suggestClose ? { metadata: { suggestClose: true } } : {}),
    });
  },
});

// Anonymous variant: no conversationId, no message rows are persisted.
// The chain still runs (so safety/clinical validators apply) and the audit
// row still lands in aiInvocations *with* userId so the cost cap and abuse
// controls remain effective. The audit row never carries inputText/outputText
// (per the existing data-minimisation contract), so even the audit reveals
// nothing about *what* was asked.
// Anonymous chat: nothing is stored as a conversation. The app keeps the
// turns in memory and sends the recent ones back as `history` so the
// assistant can follow the thread; closing the chat discards them.
export const respondAnonymous = action({
  args: {
    query: v.string(),
    history: v.optional(
      v.array(v.object({ fromPatient: v.boolean(), content: v.string() }))
    ),
  },
  handler: async (ctx, { query, history }): Promise<{
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
      conversationHistory: history?.length
        ? history
            .slice(-20)
            .map((m) => `${m.fromPatient ? 'Utente' : 'Assistente'}: ${m.content.slice(0, 2000)}`)
            .join('\n')
        : 'Conversa anónima, sem mensagens anteriores.',
      patientProfile: profile.patientProfile,
      recentSummary: profile.recentSummary,
      topicAndRisk: 'Anónimo (sem conversa)\nProfissional: conversa anónima, sem profissional.',
    };

    const draft = await runAgent(ctx, {
      purpose: 'chat',
      vars: baseVars,
      userId,
    });
    const [safety, clinical] = await Promise.all([
      runAgent(ctx, {
        purpose: 'chat-validator-safety',
        vars: { ...baseVars, draft: stripSuggestClose(draft.output).text },
        userId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
      runAgent(ctx, {
        purpose: 'chat-validator-clinical',
        vars: { ...baseVars, draft: stripSuggestClose(draft.output).text },
        userId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
    ]);
    const judged = await runAgent(ctx, {
      purpose: 'chat-judge',
      vars: {
        ...baseVars,
        draft: stripSuggestClose(draft.output).text,
        safety: JSON.stringify(safety.output),
        clinical: JSON.stringify(clinical.output),
      },
      userId,
      parentInvocationId: draft.invocationId,
      outputSchema: judgeSchema,
    });

    const sent = judged.output.action === 'send';
    // The chat prompt ends every answer with "…espera pela resposta do
    // profissional…"; there is no professional in an anonymous chat.
    const answer = sent
      ? stripSuggestClose(judged.output.finalAnswer)
          .text.replace(/\s*Para a tua situação concreta, espera pela resposta do profissional ou marca consulta presencial\.?/g, '')
          .trim()
      : 'Esta pergunta precisa de um profissional de saúde, por isso não lhe posso responder aqui. Para acompanhamento, abre uma conversa com um profissional no Início.';

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
    const { blocked } = await streamAndValidate(ctx, {
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
      blockedMessage: ctxData.escalatesOnBlock ? BLOCKED_ESCALATE : BLOCKED_AUTO,
    });
    // In an AI side chat of an open professional conversation, a question the
    // AI can't answer is forwarded to that professional conversation.
    if (blocked && ctxData.escalatesOnBlock) {
      await ctx.runMutation(internal.conversations.escalateAiConversation, {
        conversationId,
      });
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
    const formatLines = (rows: typeof messages) =>
      rows
        .map((m) => {
          const role =
            m.messageType === 'ai-response'
              ? 'AI (anterior)'
              : m.senderId === conv.patientId
                ? 'Utente'
                : 'Profissional';
          return `${role}: ${m.content}`;
        })
        .join('\n');
    let conversationHistory =
      visible.length > 0 ? formatLines(visible) : 'Sem histórico de mensagens.';

    // Conversation this one was spawned from (e.g. the professional chat the
    // patient left to talk to the AI): prepend its recent messages.
    let contextMessages: typeof messages = [];
    if (conv.contextConversationId) {
      contextMessages = (
        await ctx.db
          .query('messages')
          .withIndex('by_conversation', (q) =>
            q.eq('conversationId', conv.contextConversationId!)
          )
          .order('desc')
          .take(20)
      ).reverse();
      const contextVisible = contextMessages.filter(
        (m) => !m.isInternal && m.messageType !== 'system' && m.messageType !== 'triage-response'
      );
      if (contextVisible.length > 0) {
        conversationHistory = `Conversa anterior (com profissional):\n${formatLines(contextVisible)}\n\nConversa atual:\n${conversationHistory}`;
      }
    }

    let escalatesOnBlock = false;
    if (conv.kind === 'ai-only' && conv.counterpartConversationId) {
      const counterpart = await ctx.db.get(conv.counterpartConversationId);
      escalatesOnBlock =
        !!counterpart && counterpart.status !== 'closed' && counterpart.kind !== 'ai-only';
    }

    const triageMsg =
      messages.find((m) => m.metadata?.triageData) ??
      contextMessages.find((m) => m.metadata?.triageData);
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
    // Tells the prompt whether a professional is involved (how to end answers).
    const professionalLine = escalatesOnBlock
      ? 'Profissional: a utente tem uma conversa com um profissional em curso.'
      : 'Profissional: a utente não tem nenhuma conversa com um profissional em curso.';
    const topicAndRisk = `Tópico: ${conv.topic}${riskLabel}${goalLabel}\n${professionalLine}`;

    return {
      allowed: true as const,
      topic: conv.topic,
      conversationHistory,
      patientProfile,
      recentSummary,
      topicAndRisk,
      escalatesOnBlock,
    };
  },
});
