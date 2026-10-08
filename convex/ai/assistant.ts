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
// created immediately (streaming: true, empty) and stays empty while the draft
// is generated and checked; it is finalized (streaming: false) with the draft on approval,
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
import { getActiveUserIdInAction } from '../lib/accounts';
import { runAgent } from './runAgent';
import { SUGGEST_CLOSE_MARKER } from './defaults';
import type { Doc, Id } from '../_generated/dataModel';
import { findOpenProfessionalConversation } from '../conversations';
import { userError, NOT_AUTHENTICATED } from '../lib/errors';
import { detectSafetyRule } from '../lib/aiSafetyMessages';
import type { TopicId } from '../lib/topics';

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
  'Não consegui responder agora. Tenta novamente daqui a pouco ou fala com um enfermeiro.';
const BLOCKED_AUTO =
  'Esta pergunta merece resposta de um enfermeiro. Toca em "Falar com enfermeiro" para entrar na fila.';
const BLOCKED_RESPOND =
  'A tua pergunta foi encaminhada para a equipa clínica. Vais receber resposta de um enfermeiro.';
const BLOCKED_ESCALATE =
  'Esta pergunta precisa de um enfermeiro. Encaminhei-a para a tua conversa com o enfermeiro, que te vai responder lá.';
// The question came from the conversation with the nurse (switchMode), so it
// is already there waiting for an answer: nothing to forward.
const BLOCKED_PENDING =
  'Esta pergunta precisa de um enfermeiro. Já está na tua conversa com o enfermeiro, que te vai responder lá.';

type StreamVars = {
  query: string;
  conversationHistory: string;
  patientProfile: string;
  recentSummary: string;
  topicAndRisk: string;
};

// The chain itself: draft, then the two validators in parallel, then the judge.
// Shared by the patient-facing actions and the offline evaluation
// (ai/evaluation.ts). The draft is never shown before the judge decides.
export async function runAssistantChain(
  ctx: ActionCtx,
  args: {
    baseVars: StreamVars;
    topic?: TopicId;
    userId?: Id<'users'>;
    /** The patient the content is about (pseudonymised before the provider). */
    subjectId?: Id<'users'>;
    conversationId?: Id<'conversations'>;
  }
) {
  const { baseVars, topic, userId, subjectId, conversationId } = args;
  const draft = await runAgent(ctx, {
    purpose: 'chat',
    topic,
    vars: baseVars,
    userId,
    subjectId,
    conversationId,
  });
  const { text: draftText, suggestClose } = stripSuggestClose(draft.output);
  const validatorArgs = {
    topic,
    vars: { ...baseVars, draft: draftText },
    userId,
    subjectId,
    conversationId,
    parentInvocationId: draft.invocationId,
    outputSchema: validatorSchema,
  };
  const [safety, clinical] = await Promise.all([
    runAgent(ctx, { purpose: 'chat-validator-safety', ...validatorArgs }),
    runAgent(ctx, { purpose: 'chat-validator-clinical', ...validatorArgs }),
  ]);
  const judged = await runAgent(ctx, {
    purpose: 'chat-judge',
    topic,
    vars: {
      ...baseVars,
      draft: draftText,
      safety: JSON.stringify(safety.output),
      clinical: JSON.stringify(clinical.output),
    },
    userId,
    subjectId,
    conversationId,
    parentInvocationId: draft.invocationId,
    outputSchema: judgeSchema,
  });
  return {
    sent: judged.output.action === 'send',
    draftText,
    suggestClose,
    safety: safety.output,
    clinical: clinical.output,
    judged,
    draftInvocationId: draft.invocationId,
  };
}

// Shared: create an empty placeholder ai-response message, generate the draft,
// run the safety chain, then finalize (approved draft / blocked / fallback).
async function streamAndValidate(
  ctx: ActionCtx,
  args: {
    conversationId: Id<'conversations'>;
    patientId: Id<'users'>;
    baseVars: StreamVars;
    topic?: TopicId;
    blockedMessage: string;
  }
): Promise<{ sent: boolean; blocked: boolean }> {
  const messageId = await ctx.runMutation(
    internal.ai.assistant.createAssistantPlaceholder,
    { conversationId: args.conversationId, patientId: args.patientId }
  );
  // Rule-based detection first (lib/aiSafetyMessages): baby movements, sexual
  // violence and suicidal ideation get a fixed answer with concrete contacts,
  // without calling the model, and the conversation is escalated.
  const rule = detectSafetyRule(args.baseVars.query);
  if (rule) {
    await ctx.runMutation(internal.ai.assistant.finalizeAssistantMessage, {
      messageId,
      content: rule.message,
    });
    await ctx.runMutation(internal.conversations.flagSafetyRule, {
      conversationId: args.conversationId,
      alertLevel: rule.alertLevel,
      label: rule.label,
    });
    return { sent: true, blocked: false };
  }
  try {
    // The placeholder stays empty ("A preparar a resposta…" in the app) until
    // the validators and the judge decide.
    const { sent, draftText, suggestClose, judged } = await runAssistantChain(ctx, {
      baseVars: args.baseVars,
      topic: args.topic,
      userId: args.patientId,
      subjectId: args.patientId,
      conversationId: args.conversationId,
    });
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
    const userId = await getActiveUserIdInAction(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);

    // Same rule-based detection as the conversations: fixed answer, no model.
    const rule = detectSafetyRule(query);
    if (rule) return { sent: true, answer: rule.message };

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
      topicAndRisk: 'Anónimo (sem conversa)\nEnfermeiro: conversa anónima, sem enfermeiro.',
    };

    const { sent, judged } = await runAssistantChain(ctx, { baseVars, userId, subjectId: userId });
    // The chat prompt ends every answer with "…espera pela resposta do
    // enfermeiro…"; there is no nurse in an anonymous chat.
    const answer = sent
      ? stripSuggestClose(judged.output.finalAnswer)
          .text.replace(/\s*Para a tua situação concreta, espera pela resposta do (?:profissional|enfermeiro) ou marca consulta presencial\.?/g, '')
          .trim()
      : 'Esta pergunta precisa de um enfermeiro, por isso não lhe posso responder aqui. Para acompanhamento, abre uma conversa com um enfermeiro no Início.';

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
    // Unanswered messages from the conversation with the nurse, answered on
    // a switch to the AI (conversations.switchMode).
    pendingFromProfessional: v.optional(v.boolean()),
  },
  handler: async (ctx, { conversationId, query, pendingFromProfessional }) => {
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
      blockedMessage: pendingFromProfessional
        ? BLOCKED_PENDING
        : ctxData.escalatesOnBlock
          ? BLOCKED_ESCALATE
          : BLOCKED_AUTO,
    });
    // In an AI side chat of an open professional conversation, a question the
    // AI can't answer is forwarded to that professional conversation (unless
    // it came from there).
    if (blocked && ctxData.escalatesOnBlock && !pendingFromProfessional) {
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
    const userId = await getActiveUserIdInAction(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const ctxData = await ctx.runQuery(internal.ai.assistant.gatherContext, {
      conversationId,
      userId,
    });
    if (!ctxData.allowed) {
      throw userError('Só a utente desta conversa pode falar com a assistente.');
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
                : 'Enfermeiro';
          return `${role}: ${m.content}`;
        })
        .join('\n');
    let conversationHistory =
      visible.length > 0 ? formatLines(visible) : 'Sem histórico de mensagens.';

    // Conversation to read alongside this one. For an AI chat: the patient's
    // professional conversation on the topic — the one it was opened from, the
    // linked one, or else the open one on the same topic (an AI chat started
    // first has no context link). Otherwise: the conversation it came from.
    let contextConv: Doc<'conversations'> | null = null;
    if (conv.kind === 'ai-only') {
      for (const id of [conv.contextConversationId, conv.counterpartConversationId]) {
        if (!id) continue;
        const c = await ctx.db.get(id);
        if (c && c.patientId === userId && c.kind !== 'ai-only') {
          contextConv = c;
          break;
        }
      }
      contextConv ??= await findOpenProfessionalConversation(ctx, userId, conv.topic);
    } else if (conv.contextConversationId) {
      contextConv = await ctx.db.get(conv.contextConversationId);
    }

    let contextMessages: typeof messages = [];
    if (contextConv) {
      contextMessages = (
        await ctx.db
          .query('messages')
          .withIndex('by_conversation', (q) => q.eq('conversationId', contextConv._id))
          .order('desc')
          .take(20)
      ).reverse();
      const contextVisible = contextMessages.filter(
        (m) => !m.isInternal && m.messageType !== 'system' && m.messageType !== 'triage-response'
      );
      if (contextVisible.length > 0) {
        const label =
          contextConv.kind === 'ai-only' ? 'Conversa anterior (com a AI)' : 'Conversa com o enfermeiro';
        conversationHistory = `${label}:\n${formatLines(contextVisible)}\n\nConversa atual:\n${conversationHistory}`;
      }
    }
    const hasOpenProfessional =
      !!contextConv && contextConv.kind !== 'ai-only' && contextConv.status !== 'closed';

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
    const professionalLine =
      escalatesOnBlock || hasOpenProfessional
      ? 'Enfermeiro: a utente tem uma conversa com um enfermeiro em curso.'
      : 'Enfermeiro: a utente não tem nenhuma conversa com um enfermeiro em curso.';
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
