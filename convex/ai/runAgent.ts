import type { ZodTypeAny, z } from 'zod';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import type { GenericMutationCtx, GenericActionCtx } from 'convex/server';
import type { DataModel } from '../_generated/dataModel';
import { callLlmText, callLlmObject, callLlmStream } from './llm';
import { renderTemplate } from './template';
import { computeCostUsd } from './pricing';
import type { AiPurpose } from './types';
import { aiPurposeValidator as aiPurpose } from './registry';
import type { TopicId } from '../lib/topics';
import { topicValidator } from '../lib/topics';

type RunAgentCtx =
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>;

export type RunAgentArgs<T extends ZodTypeAny | undefined = undefined> = {
  purpose: AiPurpose;
  topic?: TopicId;
  vars: Record<string, string>;
  userId?: Id<'users'>;
  conversationId?: Id<'conversations'>;
  parentInvocationId?: Id<'aiInvocations'>;
  outputSchema?: T;
  onDelta?: (textSoFar: string) => void | Promise<void>;
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
  // Per-user daily cost cap. Live-configurable from the admin UI; persisted
  // in aiSettings (append-only, latest wins). Falls back to the constant
  // default if no row exists yet. Skipped when userId is unset (cron/system).
  if (args.userId) {
    const cap = await ctx.runQuery(internal.ai.settings.getDailyCostCap, {});
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
    topic: args.topic,
  });

  // Render template before creating the invocation row — throws early if vars missing,
  // so no orphaned 'pending' rows are left behind.
  const vars = args.topic ? { ...args.vars, topic: args.topic } : args.vars;
  const userPrompt = renderTemplate(prompt.userTemplate ?? '', vars);

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
    const llmArgs = {
      provider: config.provider,
      modelId: config.modelId,
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      systemPrompt: prompt.systemPrompt,
      userPrompt,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
    };
    const result = args.outputSchema
      ? await callLlmObject({ ...llmArgs, schema: args.outputSchema })
      : args.onDelta
        ? await callLlmStream({ ...llmArgs, onDelta: args.onDelta })
        : await callLlmText(llmArgs);

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
export const run = internalAction({
  args: {
    purpose: aiPurpose,
    topic: v.optional(topicValidator),
    vars: v.record(v.string(), v.string()),
    userId: v.optional(v.id('users')),
    conversationId: v.optional(v.id('conversations')),
    parentInvocationId: v.optional(v.id('aiInvocations')),
  },
  handler: async (ctx, args): Promise<{ output: string; invocationId: Id<'aiInvocations'> }> => {
    return runAgent(ctx, args);
  },
});
