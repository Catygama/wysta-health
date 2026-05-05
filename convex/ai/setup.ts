// CLI-only helpers for bootstrapping and smoke-testing the AI infra.
// Exposed as internal* so they can only be invoked via deployment-admin
// access (`bunx convex run`), never from a client.

import { internalMutation, internalAction, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { runAgent } from './runAgent';

const aiPurpose = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge')
);

const aiProvider = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('mistral'),
  v.literal('google'),
  v.literal('azure-openai'),
  v.literal('custom')
);

// Returns the first user in the table, or throws. Used to attribute
// `createdBy` on seeded rows when no admin auth context exists.
async function firstUserId(ctx: { db: { query: (table: 'users') => any } }) {
  const u = await ctx.db.query('users').first();
  if (!u) throw new Error('No users in DB — create one before seeding configs');
  return u._id;
}

export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').take(10);
    return users.map((u) => ({ _id: u._id, _creationTime: u._creationTime }));
  },
});

export const seedConfig = internalMutation({
  args: {
    purpose: aiPurpose,
    provider: aiProvider,
    modelId: v.string(),
    endpoint: v.optional(v.string()),
    apiKey: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const createdBy = await firstUserId(ctx);
    return ctx.db.insert('aiConfigs', { ...args, createdBy });
  },
});

export const seedPrompt = internalMutation({
  args: {
    purpose: aiPurpose,
    systemPrompt: v.string(),
    userTemplate: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const createdBy = await firstUserId(ctx);
    return ctx.db.insert('aiPrompts', { ...args, createdBy });
  },
});

export const testChatSummary = internalAction({
  args: { conversationText: v.string() },
  handler: async (ctx, { conversationText }) => {
    const result = await runAgent(ctx, {
      purpose: 'chat-summary',
      vars: { conversationText },
    });
    return { output: result.output, invocationId: result.invocationId };
  },
});

export const getLatestInvocation = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query('aiInvocations').order('desc').first();
  },
});
