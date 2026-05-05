import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { ZodTypeAny, z } from 'zod';
import type { AiProvider } from './types';

export type LlmCallArgs = {
  provider: AiProvider;
  modelId: string;
  endpoint?: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type LlmCallResult<T = string> = {
  output: T;
  inputTokens: number;
  outputTokens: number;
};

function buildModel(args: LlmCallArgs) {
  switch (args.provider) {
    case 'anthropic': {
      const client = createAnthropic({
        apiKey: args.apiKey,
        ...(args.endpoint ? { baseURL: args.endpoint } : {}),
      });
      return client(args.modelId);
    }
    // Other providers are added on demand. Each new provider:
    //   1. bun add @ai-sdk/<provider>
    //   2. case '<provider>': return createX({...})(modelId);
    //   3. add pricing entry in pricing.ts
    default:
      throw new Error(`Provider not yet wired: ${args.provider}`);
  }
}

export async function callLlmText(args: LlmCallArgs): Promise<LlmCallResult<string>> {
  const result = await generateText({
    model: buildModel(args),
    system: args.systemPrompt,
    prompt: args.userPrompt,
    temperature: args.temperature,
    // AI SDK v6 renamed maxTokens → maxOutputTokens
    maxOutputTokens: args.maxTokens,
  });
  return {
    output: result.text,
    // AI SDK v6 renamed usage.promptTokens → usage.inputTokens
    // and usage.completionTokens → usage.outputTokens
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}

export async function callLlmObject<T extends ZodTypeAny>(
  args: LlmCallArgs & { schema: T }
): Promise<LlmCallResult<z.infer<T>>> {
  const result = await generateObject({
    model: buildModel(args),
    system: args.systemPrompt,
    prompt: args.userPrompt,
    schema: args.schema,
    temperature: args.temperature,
    // AI SDK v6 renamed maxTokens → maxOutputTokens
    maxOutputTokens: args.maxTokens,
  });
  return {
    // Cast needed: AI SDK uses InferSchema<T> internally; Zod uses output<T>.
    // These are equivalent at runtime; the cast bridges the type-level gap.
    output: result.object as z.infer<T>,
    // AI SDK v6 renamed usage.promptTokens → usage.inputTokens
    // and usage.completionTokens → usage.outputTokens
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}
