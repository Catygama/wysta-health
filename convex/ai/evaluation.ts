// Runs the patient assistant chain on one test question, outside any
// conversation, and reports the decision plus the chain's latency and cost.
// Driven by scripts/ai-eval.ts; nothing is written to messages.

import { internalAction, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { topicValidator } from '../lib/topics';
import { runAssistantChain } from './assistant';
import { detectSafetyRule } from '../lib/aiSafetyMessages';

type ChainUsage = { costUsd: number; calls: number };

// 'regra': answered by the rule-based detection, no model call.
type Decision = 'approve' | 'block' | 'regra';

export type EvaluationRun = ChainUsage & {
  sent: boolean;
  safety: Decision;
  clinical: Decision;
  answer: string;
  latencyMs: number;
};

export const chainUsage = internalQuery({
  args: { draftInvocationId: v.id('aiInvocations') },
  handler: async (ctx, { draftInvocationId }): Promise<ChainUsage> => {
    const draft = await ctx.db.get(draftInvocationId);
    const children = await ctx.db
      .query('aiInvocations')
      .withIndex('by_parent', (q) => q.eq('parentInvocationId', draftInvocationId))
      .take(10);
    const rows = draft ? [draft, ...children] : children;
    return {
      costUsd: rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
      calls: rows.length,
    };
  },
});

export const runCase = internalAction({
  args: { query: v.string(), topic: v.optional(topicValidator) },
  handler: async (ctx, { query, topic }): Promise<EvaluationRun> => {
    const startedAt = Date.now();
    // Same order as the patient-facing chat: rule-based detection first.
    const rule = detectSafetyRule(query);
    if (rule) {
      return {
        sent: true,
        safety: 'regra',
        clinical: 'regra',
        answer: rule.message,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        calls: 0,
      };
    }
    const result = await runAssistantChain(ctx, {
      topic,
      baseVars: {
        query,
        conversationHistory: 'Sem histórico de mensagens.',
        patientProfile: 'Sem dados clínicos estruturados registados.',
        recentSummary: 'Sem histórico clínico.',
        topicAndRisk: topic ? `Tópico: ${topic}` : 'Sem tópico',
      },
    });
    const latencyMs = Date.now() - startedAt;
    const { costUsd, calls }: ChainUsage = await ctx.runQuery(internal.ai.evaluation.chainUsage, {
      draftInvocationId: result.draftInvocationId,
    });
    return {
      sent: result.sent,
      safety: result.safety.decision,
      clinical: result.clinical.decision,
      answer: result.draftText,
      latencyMs,
      costUsd,
      calls,
    };
  },
});
