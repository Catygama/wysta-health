import type { ZodTypeAny, z } from 'zod';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import type { GenericMutationCtx, GenericActionCtx } from 'convex/server';
import type { DataModel } from '../_generated/dataModel';
import { callLlmText, callLlmObject } from './llm';
import { renderTemplate } from './template';
import { computeCostUsd } from './pricing';
import type { AiPurpose } from './types';

type RunAgentCtx =
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>;

export type RunAgentArgs<T extends ZodTypeAny | undefined = undefined> = {
  purpose: AiPurpose;
  vars: Record<string, string>;
  userId?: Id<'users'>;
  conversationId?: Id<'conversations'>;
  parentInvocationId?: Id<'aiInvocations'>;
  outputSchema?: T;
};

export type RunAgentResult<T> = {
  output: T;
  invocationId: Id<'aiInvocations'>;
};

export async function runAgent<T extends ZodTypeAny | undefined = undefined>(
  ctx: RunAgentCtx,
  args: RunAgentArgs<T>
): Promise<
  RunAgentResult<T extends ZodTypeAny ? z.infer<T> : string>
> {
  // Per-user daily cost cap. Default $0.50/day; override via env
  // AI_DAILY_COST_CAP_USD. Skipped when userId is unset (cron/system).
  if (args.userId) {
    const cap = Number(process.env.AI_DAILY_COST_CAP_USD ?? '0.50');
    const spent = await ctx.runQuery(internal.ai.invocations.dailySpentForUser, {
      userId: args.userId,
    });
    if (spent >= cap) {
      throw new Error(
        `Daily AI cost cap reached for user ($${spent.toFixed(4)} / $${cap.toFixed(2)})`
      );
    }
  }

  const config = await ctx.runQuery(internal.ai.configs.getActiveConfig, {
    purpose: args.purpose,
  });
  const prompt = await ctx.runQuery(internal.ai.prompts.getActivePrompt, {
    purpose: args.purpose,
  });

  // Render template before creating the invocation row — throws early if vars missing,
  // so no orphaned 'pending' rows are left behind.
  const userPrompt = renderTemplate(prompt.userTemplate ?? '', args.vars);

  const invocationId = await ctx.runMutation(
    internal.ai.invocations.createInvocation,
    {
      purpose: args.purpose,
      configId: config._id,
      promptId: prompt._id,
      userId: args.userId,
      conversationId: args.conversationId,
      parentInvocationId: args.parentInvocationId,
    }
  );

  const startedAt = Date.now();
  try {
    const result = args.outputSchema
      ? await callLlmObject({
          provider: config.provider,
          modelId: config.modelId,
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          systemPrompt: prompt.systemPrompt,
          userPrompt,
          temperature: prompt.temperature,
          maxTokens: prompt.maxTokens,
          schema: args.outputSchema,
        })
      : await callLlmText({
          provider: config.provider,
          modelId: config.modelId,
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          systemPrompt: prompt.systemPrompt,
          userPrompt,
          temperature: prompt.temperature,
          maxTokens: prompt.maxTokens,
        });

    const latencyMs = Date.now() - startedAt;
    const costUsd = computeCostUsd(
      config.provider,
      config.modelId,
      result.inputTokens,
      result.outputTokens
    );

    await ctx.runMutation(internal.ai.invocations.completeInvocation, {
      invocationId,
      status: 'success',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
      latencyMs,
    });

    return {
      output: result.output as any,
      invocationId,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await ctx.runMutation(internal.ai.invocations.completeInvocation, {
      invocationId,
      status: 'error',
      errorMessage,
      latencyMs,
    });
    throw err;
  }
}

// Registered action wrapper — allows calling runAgent from Convex actions
// where each ctx.runMutation is an independently committed transaction.
// Use this when you need durable error audit trails.
const aiPurpose = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge')
);

export const run = internalAction({
  args: {
    purpose: aiPurpose,
    vars: v.record(v.string(), v.string()),
    userId: v.optional(v.id('users')),
    conversationId: v.optional(v.id('conversations')),
    parentInvocationId: v.optional(v.id('aiInvocations')),
  },
  handler: async (ctx, args): Promise<{ output: string; invocationId: Id<'aiInvocations'> }> => {
    return runAgent(ctx, args);
  },
});
