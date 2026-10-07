import { internalMutation, mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { TRIAGE_SEEDS, ARTICLE_SEEDS, type TriageSeed, type ArticleSeed } from './lib/seedData';
import { alertLevelFor } from './lib/alerts';

async function upsertTriage(ctx: MutationCtx, seed: TriageSeed) {
  const existing = await ctx.db
    .query('triageQuestions')
    .withIndex('by_topic', (q) => q.eq('topic', seed.topic))
    .unique();
  // A triage an admin edited in Conteúdos is left as it is.
  if (existing?.updatedAt) return 'kept' as const;
  if (existing) {
    await ctx.db.patch(existing._id, {
      questions: seed.questions,
      riskAssessment: seed.riskAssessment,
    });
    return 'updated' as const;
  }
  await ctx.db.insert('triageQuestions', seed);
  return 'inserted' as const;
}

async function upsertArticle(ctx: MutationCtx, seed: ArticleSeed) {
  const existing = await ctx.db
    .query('educationalContent')
    .withIndex('by_topic', (q) => q.eq('topic', seed.topic))
    .collect();
  // Matched by the seed's own title (kept in seedKey when an admin renames
  // it). Articles an admin edited in Conteúdos are left as they are.
  const match = existing.find((a) => (a.seedKey ?? a.title) === seed.title);
  if (match?.updatedAt) return 'kept' as const;
  if (match) {
    await ctx.db.patch(match._id, {
      summary: seed.summary,
      content: seed.content,
      whenToSeekHelp: seed.whenToSeekHelp,
      tags: seed.tags,
      readingTimeMinutes: seed.readingTimeMinutes,
      isPublished: true,
    });
    return 'updated' as const;
  }
  await ctx.db.insert('educationalContent', { ...seed, isPublished: true, seedKey: seed.title });
  return 'inserted' as const;
}

// Migration: give open conversations created before triage alert levels their
// level, recomputed from the answers stored on the triage message with the
// current questions. Priority is left alone (a professional may have changed
// it); the queue ranks by the higher of the two. Idempotent.
async function backfillAlertLevels(ctx: MutationCtx) {
  let updated = 0;
  for (const status of ['waiting', 'active', 'escalated'] as const) {
    const open = await ctx.db
      .query('conversations')
      .withIndex('by_status', (q) => q.eq('status', status))
      .take(500);
    for (const c of open) {
      if (c.alertLevel || c.kind === 'ai-only') continue;
      const seed = TRIAGE_SEEDS.find((t) => t.topic === c.topic);
      if (!seed) continue;
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .take(20);
      const triage = messages.find((m) => m.messageType === 'triage-response');
      const responses = triage?.metadata?.triageData?.responses;
      if (!responses) continue;
      const level = alertLevelFor(seed.questions, responses);
      if (level) {
        await ctx.db.patch(c._id, { alertLevel: level });
        updated++;
      }
    }
  }
  return updated;
}

async function isAdminOrEmpty(ctx: MutationCtx) {
  const anyAdmin = await ctx.db
    .query('userProfiles')
    .filter((q) => q.eq(q.field('role'), 'admin'))
    .first();
  // Bootstrap path: if no admin exists yet, allow first authenticated caller
  // to seed. Once an admin exists, only admins can call seedAll.
  if (!anyAdmin) {
    const userId = await getAuthUserId(ctx);
    return userId !== null;
  }
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return profile?.role === 'admin';
}

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdminOrEmpty(ctx))) {
      throw new Error('Apenas administradores podem executar seed.');
    }
    const triageResults = await Promise.all(TRIAGE_SEEDS.map((t) => upsertTriage(ctx, t)));
    const articleResults = await Promise.all(ARTICLE_SEEDS.map((a) => upsertArticle(ctx, a)));
    const alertLevelsBackfilled = await backfillAlertLevels(ctx);
    return {
      alertLevelsBackfilled,
      triage: {
        inserted: triageResults.filter((r) => r === 'inserted').length,
        updated: triageResults.filter((r) => r === 'updated').length,
        kept: triageResults.filter((r) => r === 'kept').length,
      },
      articles: {
        inserted: articleResults.filter((r) => r === 'inserted').length,
        updated: articleResults.filter((r) => r === 'updated').length,
        kept: articleResults.filter((r) => r === 'kept').length,
      },
    };
  },
});

// Refreshes only the triage questionnaires (articles untouched). Internal: run
// from the CLI, e.g. "bunx convex run seed:seedTriage" (add --prod for prod).
export const seedTriage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results = await Promise.all(TRIAGE_SEEDS.map((t) => upsertTriage(ctx, t)));
    const alertLevelsBackfilled = await backfillAlertLevels(ctx);
    return {
      alertLevelsBackfilled,
      inserted: results.filter((r) => r === 'inserted').length,
      updated: results.filter((r) => r === 'updated').length,
      kept: results.filter((r) => r === 'kept').length,
    };
  },
});

// Refreshes only the educational articles (matched by topic + title). Internal:
// run from the CLI, e.g. "bunx convex run seed:seedArticles" (add --prod for prod).
export const seedArticles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results = await Promise.all(ARTICLE_SEEDS.map((a) => upsertArticle(ctx, a)));
    return {
      inserted: results.filter((r) => r === 'inserted').length,
      updated: results.filter((r) => r === 'updated').length,
      kept: results.filter((r) => r === 'kept').length,
    };
  },
});
