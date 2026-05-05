// Test-only mutations / actions used by Playwright. All exports throw unless
// CONVEX_E2E_ENABLED=true on the Convex deployment, so production deploys can
// safely contain this file (the env gate is what keeps it inert in prod).

import {
  action,
  mutation,
  query,
  internalMutation,
} from './_generated/server';
import { v } from 'convex/values';
import { createAccount } from '@convex-dev/auth/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { TRIAGE_SEEDS, ARTICLE_SEEDS } from './lib/seedData';
import { runAgent } from './ai/runAgent';

function assertE2E() {
  if (process.env.CONVEX_E2E_ENABLED !== 'true') {
    throw new Error(
      'convex/testing.* is gated by CONVEX_E2E_ENABLED=true; refusing in production',
    );
  }
}

const DOMAIN_TABLES = [
  'auditLog',
  'messages',
  'conversations',
  'userProfiles',
  'triageQuestions',
  'educationalContent',
  'aiConfigs',
  'aiPrompts',
  'aiInvocations',
  'aiSettings',
] as const;

const AUTH_TABLES = [
  'authRateLimits',
  'authVerifiers',
  'authVerificationCodes',
  'authRefreshTokens',
  'authSessions',
  'authAccounts',
  'users',
] as const;

async function wipeTable(ctx: any, table: string): Promise<number> {
  let total = 0;
  while (true) {
    const batch = await ctx.db.query(table).take(200);
    if (batch.length === 0) return total;
    for (const row of batch) {
      await ctx.db.delete(row._id);
    }
    total += batch.length;
  }
}

export const resetAll = mutation({
  args: {},
  handler: async (ctx) => {
    assertE2E();
    const counts: Record<string, number> = {};
    for (const t of DOMAIN_TABLES) counts[t] = await wipeTable(ctx, t);
    for (const t of AUTH_TABLES) counts[t] = await wipeTable(ctx, t);
    return counts;
  },
});

const profileFields = {
  displayName: v.optional(v.string()),
  ageRange: v.optional(v.string()),
  location: v.optional(v.string()),
  pregnancyStatus: v.optional(v.string()),
  conditions: v.optional(v.array(v.string())),
  medications: v.optional(v.array(v.string())),
  professionalLicenseNumber: v.optional(v.string()),
  professionalSpecialty: v.optional(v.string()),
  professionalVerificationStatus: v.optional(
    v.union(
      v.literal('pending'),
      v.literal('verified'),
      v.literal('rejected'),
    ),
  ),
};

export const upsertProfile = internalMutation({
  args: {
    userId: v.id('users'),
    role: v.union(
      v.literal('patient'),
      v.literal('professional'),
      v.literal('admin'),
    ),
    profile: v.optional(v.object(profileFields)),
  },
  handler: async (ctx, args) => {
    assertE2E();
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    const data = {
      role: args.role,
      ...(args.profile ?? {}),
      ...(args.role === 'professional' &&
      !args.profile?.professionalVerificationStatus
        ? { professionalVerificationStatus: 'verified' as const }
        : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return ctx.db.insert('userProfiles', { userId: args.userId, ...data });
  },
});

export const seedUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    role: v.union(
      v.literal('patient'),
      v.literal('professional'),
      v.literal('admin'),
    ),
    profile: v.optional(v.object(profileFields)),
  },
  handler: async (ctx, args): Promise<{ userId: Id<'users'> }> => {
    assertE2E();
    const result = (await createAccount(ctx, {
      provider: 'password',
      account: { id: args.email, secret: args.password },
      profile: { email: args.email },
      shouldLinkViaEmail: false,
    })) as { user: { _id: Id<'users'> } };
    const userId = result.user._id;
    await ctx.runMutation(internal.testing.upsertProfile, {
      userId,
      role: args.role,
      profile: args.profile,
    });
    return { userId };
  },
});

export const setUserProfile = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal('patient'),
      v.literal('professional'),
      v.literal('admin'),
    ),
    profile: v.optional(v.object(profileFields)),
  },
  handler: async (ctx, args) => {
    assertE2E();
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.email))
      .unique();
    if (!user) throw new Error(`User not found by email: ${args.email}`);
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    const data = {
      role: args.role,
      ...(args.profile ?? {}),
      ...(args.role === 'professional' &&
      !args.profile?.professionalVerificationStatus
        ? { professionalVerificationStatus: 'verified' as const }
        : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return ctx.db.insert('userProfiles', { userId: user._id, ...data });
  },
});

export const getUserIdByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    assertE2E();
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.email))
      .unique();
    return user?._id ?? null;
  },
});

const topic = v.union(
  v.literal('contraception'),
  v.literal('pregnancy'),
  v.literal('sti'),
  v.literal('menstrual-cycle'),
  v.literal('general'),
);

const priority = v.union(
  v.literal('low'),
  v.literal('medium'),
  v.literal('high'),
  v.literal('urgent'),
);

const status = v.union(
  v.literal('waiting'),
  v.literal('active'),
  v.literal('escalated'),
  v.literal('closed'),
);

export const seedConversation = mutation({
  args: {
    patientEmail: v.string(),
    professionalEmail: v.optional(v.string()),
    topic,
    title: v.optional(v.string()),
    priority: v.optional(priority),
    status: v.optional(status),
    riskLevel: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
    ),
    initialMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertE2E();
    const patient = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.patientEmail))
      .unique();
    if (!patient) throw new Error(`Patient not found: ${args.patientEmail}`);
    let professionalId: Id<'users'> | undefined;
    if (args.professionalEmail) {
      const prof = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', args.professionalEmail!))
        .unique();
      if (!prof) {
        throw new Error(`Professional not found: ${args.professionalEmail}`);
      }
      professionalId = prof._id;
    }
    const conversationId = await ctx.db.insert('conversations', {
      patientId: patient._id,
      professionalId,
      topic: args.topic,
      title: args.title ?? `${args.topic} — teste`,
      priority: args.priority ?? 'low',
      status: args.status ?? 'waiting',
      lastMessageAt: Date.now(),
      riskLevel: args.riskLevel,
    });
    if (args.initialMessage) {
      await ctx.db.insert('messages', {
        conversationId,
        senderId: patient._id,
        content: args.initialMessage,
        messageType: 'text',
      });
    }
    return { conversationId };
  },
});

export const listConversationsForPatient = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    assertE2E();
    const patient = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.email))
      .unique();
    if (!patient) return [];
    return ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', patient._id))
      .order('desc')
      .collect();
  },
});

export const getConversation = query({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    assertE2E();
    return ctx.db.get(args.id);
  },
});

export const listMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    assertE2E();
    return ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .collect();
  },
});

// --- AI infra helpers (E2E-gated) ---------------------------------------

const aiPurpose = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge'),
);

const aiProvider = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('mistral'),
  v.literal('google'),
  v.literal('azure-openai'),
  v.literal('custom'),
);

export const seedAiConfig = mutation({
  args: {
    purpose: aiPurpose,
    provider: aiProvider,
    modelId: v.string(),
    endpoint: v.optional(v.string()),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    assertE2E();
    const someUser = await ctx.db.query('users').first();
    if (!someUser) throw new Error('No users to attribute createdBy');
    return ctx.db.insert('aiConfigs', { ...args, createdBy: someUser._id });
  },
});

export const seedAiPrompt = mutation({
  args: {
    purpose: aiPurpose,
    systemPrompt: v.string(),
    userTemplate: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertE2E();
    const someUser = await ctx.db.query('users').first();
    if (!someUser) throw new Error('No users to attribute createdBy');
    return ctx.db.insert('aiPrompts', { ...args, createdBy: someUser._id });
  },
});

export const runChatSummaryTest = action({
  args: { conversationText: v.string() },
  handler: async (ctx, { conversationText }) => {
    assertE2E();
    const result = await runAgent(ctx, {
      purpose: 'chat-summary',
      vars: { conversationText },
    });
    return { output: result.output, invocationId: result.invocationId };
  },
});

export const getLatestAiInvocation = query({
  args: {},
  handler: async (ctx) => {
    assertE2E();
    return ctx.db.query('aiInvocations').order('desc').first();
  },
});

export const listAiConfigsRaw = query({
  args: {},
  handler: async (ctx) => {
    assertE2E();
    return ctx.db.query('aiConfigs').order('desc').take(10);
  },
});

// --- end AI infra helpers ------------------------------------------------

export const seedDomainContent = mutation({
  args: {},
  handler: async (ctx) => {
    assertE2E();
    for (const seed of TRIAGE_SEEDS) {
      const existing = await ctx.db
        .query('triageQuestions')
        .withIndex('by_topic', (q) => q.eq('topic', seed.topic))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          questions: seed.questions,
          riskAssessment: seed.riskAssessment,
        });
      } else {
        await ctx.db.insert('triageQuestions', seed);
      }
    }
    for (const seed of ARTICLE_SEEDS) {
      const existing = await ctx.db
        .query('educationalContent')
        .withIndex('by_topic', (q) => q.eq('topic', seed.topic))
        .collect();
      const match = existing.find((a) => a.title === seed.title);
      if (match) {
        await ctx.db.patch(match._id, { ...seed, isPublished: true });
      } else {
        await ctx.db.insert('educationalContent', {
          ...seed,
          isPublished: true,
        });
      }
    }
    return { ok: true };
  },
});
