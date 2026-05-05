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

import { action, internalMutation, internalQuery } from '../_generated/server';
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

    const access = await ctx.runQuery(internal.ai.assistant.assertPatientAccess, {
      conversationId,
      userId,
    });
    if (!access.allowed) {
      throw new Error('Only the patient on this conversation can ask the AI');
    }

    // Step 1: draft
    const draft = await runAgent(ctx, {
      purpose: 'chat',
      vars: { query },
      userId,
      conversationId,
    });

    // Step 2: parallel validators
    const [safety, clinical] = await Promise.all([
      runAgent(ctx, {
        purpose: 'chat-validator-safety',
        vars: { query, draft: draft.output },
        userId,
        conversationId,
        parentInvocationId: draft.invocationId,
        outputSchema: validatorSchema,
      }),
      runAgent(ctx, {
        purpose: 'chat-validator-clinical',
        vars: { query, draft: draft.output },
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

export const assertPatientAccess = internalQuery({
  args: { conversationId: v.id('conversations'), userId: v.id('users') },
  handler: async (ctx, { conversationId, userId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return { allowed: false as const };
    if (conv.patientId !== userId) return { allowed: false as const };
    if (conv.status === 'closed') return { allowed: false as const };
    return { allowed: true as const };
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
