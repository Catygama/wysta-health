// Admin control plane for the AI subsystem. Everything the admin screen needs
// to VIEW and EDIT prompts, model/provider configs, and API keys lives here,
// gated by requireAdmin. Storage stays append-only (latest row per purpose
// wins) so every edit is a new version and history is preserved for free.

import { v } from 'convex/values';
import { action, mutation, query } from '../_generated/server';
import { internal } from '../_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { requireAdmin } from '../lib/auth';
import { runAgent } from './runAgent';
import { maskApiKey } from './configs';
import { DEFAULT_PROMPTS, DEFAULT_CONFIGS, DEFAULT_TOPIC_PROMPTS } from './defaults';
import {
  AI_PURPOSES,
  AI_PROVIDERS,
  WIRED_PROVIDERS,
  AI_PURPOSE_META,
  AI_PIPELINES,
  aiPurposeValidator as aiPurpose,
  aiProviderValidator as aiProvider,
} from './registry';
import { topicValidator, TOPIC_IDS } from '../lib/topics';
import type { Doc } from '../_generated/dataModel';

// Latest config + latest prompt for a purpose (or null). Helper shared by the
// queries below. Uses the by_purpose index, newest first.
async function latestFor(
  ctx: { db: any },
  purpose: (typeof AI_PURPOSES)[number]
): Promise<{ config: Doc<'aiConfigs'> | null; prompt: Doc<'aiPrompts'> | null }> {
  const config = await ctx.db
    .query('aiConfigs')
    .withIndex('by_purpose', (q: any) => q.eq('purpose', purpose))
    .order('desc')
    .first();
  const prompt = await ctx.db
    .query('aiPrompts')
    .withIndex('by_purpose_and_topic', (q: any) => q.eq('purpose', purpose).eq('topic', undefined))
    .order('desc')
    .first();
  return { config, prompt };
}

// Full snapshot for the admin control plane: every purpose with its active
// prompt (full text) and active config (key MASKED — reveal separately).
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const purposes = [];
    for (const purpose of AI_PURPOSES) {
      const { config, prompt } = await latestFor(ctx, purpose);
      const meta = AI_PURPOSE_META[purpose];

      // Latest prompt per topic (variants only — topic set).
      const recentPrompts = await ctx.db
        .query('aiPrompts')
        .withIndex('by_purpose', (q) => q.eq('purpose', purpose))
        .order('desc')
        .take(200);
      const seenTopics = new Set<string>();
      const topicVariants: Array<{ topic: string; prompt: any }> = [];
      for (const p of recentPrompts) {
        if (!p.topic || seenTopics.has(p.topic)) continue;
        seenTopics.add(p.topic);
        topicVariants.push({
          topic: p.topic,
          prompt: {
            _id: p._id,
            _creationTime: p._creationTime,
            systemPrompt: p.systemPrompt,
            userTemplate: p.userTemplate ?? '',
            temperature: p.temperature ?? null,
            maxTokens: p.maxTokens ?? null,
            notes: p.notes ?? null,
          },
        });
      }

      purposes.push({
        purpose,
        meta,
        hasDefaultPrompt: !!DEFAULT_PROMPTS[purpose],
        defaultModel: DEFAULT_CONFIGS[purpose]
          ? `${DEFAULT_CONFIGS[purpose]!.provider} / ${DEFAULT_CONFIGS[purpose]!.modelId}`
          : null,
        config: config
          ? {
              _id: config._id,
              _creationTime: config._creationTime,
              provider: config.provider,
              modelId: config.modelId,
              endpoint: config.endpoint ?? null,
              apiKeyMasked: maskApiKey(config.apiKey),
              notes: config.notes ?? null,
            }
          : null,
        prompt: prompt
          ? {
              _id: prompt._id,
              _creationTime: prompt._creationTime,
              systemPrompt: prompt.systemPrompt,
              userTemplate: prompt.userTemplate ?? '',
              temperature: prompt.temperature ?? null,
              maxTokens: prompt.maxTokens ?? null,
              notes: prompt.notes ?? null,
            }
          : null,
        topicVariants,
      });
    }

    return {
      purposes,
      providers: AI_PROVIDERS,
      wiredProviders: WIRED_PROVIDERS,
      pipelines: AI_PIPELINES,
      availableTopics: TOPIC_IDS,
    };
  },
});

// Reveal-on-click: returns the FULL plaintext key of the active config for a
// purpose. Admin-only. Kept separate from overview so keys aren't shipped to
// the client unless explicitly requested.
export const revealKey = query({
  args: { purpose: aiPurpose },
  handler: async (ctx, { purpose }) => {
    await requireAdmin(ctx);
    const { config } = await latestFor(ctx, purpose);
    return config ? config.apiKey : null;
  },
});

// Save a config edit. Append-only (new row). If apiKey is omitted or blank,
// the previous active key for this purpose is carried forward — so the admin
// can change just the model/provider without re-pasting the key. Throws if
// there's no prior key and none was supplied.
export const saveConfig = mutation({
  args: {
    purpose: aiPurpose,
    provider: aiProvider,
    modelId: v.string(),
    endpoint: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    let apiKey = args.apiKey?.trim();
    if (!apiKey) {
      const prev = await ctx.db
        .query('aiConfigs')
        .withIndex('by_purpose', (q) => q.eq('purpose', args.purpose))
        .order('desc')
        .first();
      if (!prev) {
        throw new Error('Sem key anterior para reutilizar — cola uma API key.');
      }
      apiKey = prev.apiKey;
    }

    return ctx.db.insert('aiConfigs', {
      purpose: args.purpose,
      provider: args.provider,
      modelId: args.modelId.trim(),
      endpoint: args.endpoint?.trim() || undefined,
      apiKey,
      notes: args.notes?.trim() || undefined,
      createdBy: userId,
    });
  },
});

// Save a prompt edit. Append-only (new version).
export const savePrompt = mutation({
  args: {
    purpose: aiPurpose,
    topic: v.optional(topicValidator),
    systemPrompt: v.string(),
    userTemplate: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    if (args.systemPrompt.trim().length === 0) {
      throw new Error('O prompt de sistema não pode estar vazio.');
    }
    return ctx.db.insert('aiPrompts', {
      purpose: args.purpose,
      topic: args.topic,
      systemPrompt: args.systemPrompt,
      userTemplate: args.userTemplate?.trim() || undefined,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      notes: args.notes?.trim() || undefined,
      createdBy: userId,
    });
  },
});

// Restore the canonical default prompt (from defaults.ts) for a purpose. No
// key needed — only touches aiPrompts. Inserts a new version, so the edit
// history is kept.
export const resetPromptToDefault = mutation({
  args: { purpose: aiPurpose, topic: v.optional(topicValidator) },
  handler: async (ctx, { purpose, topic }) => {
    const { userId } = await requireAdmin(ctx);
    const def = topic
      ? DEFAULT_TOPIC_PROMPTS[purpose]?.[topic]
      : DEFAULT_PROMPTS[purpose];
    if (!def) {
      throw new Error(
        `Sem prompt default registado para: ${purpose}${topic ? ` / ${topic}` : ''}`
      );
    }
    return ctx.db.insert('aiPrompts', {
      purpose,
      topic,
      systemPrompt: def.systemPrompt,
      userTemplate: def.userTemplate,
      temperature: def.temperature,
      maxTokens: def.maxTokens,
      notes: 'reposto a partir do default',
      createdBy: userId,
    });
  },
});

// Generic test harness: run any purpose with admin-supplied template vars and
// return the raw output + invocation id. Cost-bearing — admin-gated. Skips the
// per-user cost cap (no userId) so prompt iteration isn't throttled.
export const testPurpose = action({
  args: {
    purpose: aiPurpose,
    vars: v.record(v.string(), v.string()),
  },
  handler: async (
    ctx,
    { purpose, vars }
  ): Promise<{ output: string; invocationId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const isAdmin = await ctx.runQuery(internal.ai.chatSummary.isCallerAdmin, {
      userId,
    });
    if (!isAdmin) throw new Error('Admin only');
    const result = await runAgent(ctx, { purpose, vars });
    return { output: result.output, invocationId: result.invocationId };
  },
});
