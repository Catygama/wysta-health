import { query, mutation } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { topicValidator } from './lib/topics';
import { requireAdmin } from './lib/auth';
import { readingTimeFor } from './lib/readingTime';

export const listByTopic = query({
  args: {
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.topic) {
      return ctx.db
        .query('educationalContent')
        .withIndex('by_topic', (q) => q.eq('topic', args.topic as any))
        .filter((q) => q.eq(q.field('isPublished'), true))
        .collect();
    }
    return ctx.db
      .query('educationalContent')
      .withIndex('by_published', (q) => q.eq('isPublished', true))
      .collect();
  },
});

async function isAdmin(ctx: QueryCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return profile?.role === 'admin';
}

// A published article, for anyone. Drafts only for admins (editor preview).
export const get = query({
  args: { id: v.id('educationalContent') },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) return null;
    if (!article.isPublished && !(await isAdmin(ctx))) return null;
    return article;
  },
});

// Admin "Conteúdos": every article, published or draft, most recently edited
// first (seeded articles, never edited, by creation).
export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const articles = await ctx.db.query('educationalContent').order('desc').take(500);
    return articles
      .map((a) => ({
        _id: a._id,
        title: a.title,
        topic: a.topic,
        summary: a.summary,
        isPublished: a.isPublished,
        readingTimeMinutes: a.readingTimeMinutes,
        editedAt: a.updatedAt ?? a._creationTime,
      }))
      .sort((a, b) => b.editedAt - a.editedAt);
  },
});

// Creates or edits an article from the admin editor. `publish` sets whether it
// is visible in Explorar; publishing needs a title, summary and text.
export const save = mutation({
  args: {
    id: v.optional(v.id('educationalContent')),
    title: v.string(),
    topic: topicValidator,
    summary: v.string(),
    content: v.string(),
    whenToSeekHelp: v.optional(v.string()),
    publish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const title = args.title.trim();
    const summary = args.summary.trim();
    const content = args.content.trim();
    const whenToSeekHelp = args.whenToSeekHelp?.trim() || undefined;
    if (!title) throw new Error('O artigo precisa de um título.');
    if (args.publish && (!summary || !content)) {
      throw new Error('Para publicar, preenche o resumo e o texto.');
    }

    const data = {
      title,
      topic: args.topic,
      summary,
      content,
      whenToSeekHelp,
      isPublished: args.publish,
      readingTimeMinutes: readingTimeFor(summary, content, whenToSeekHelp),
      updatedAt: Date.now(),
    };

    let id = args.id;
    let wasPublished = false;
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing) throw new Error('Artigo não encontrado.');
      wasPublished = existing.isPublished;
      // First admin edit of a built-in article: remember its original title.
      const seedKey = existing.seedKey ?? (existing.updatedAt ? undefined : existing.title);
      await ctx.db.patch(id, { ...data, seedKey });
    } else {
      id = await ctx.db.insert('educationalContent', { ...data, tags: [] });
    }

    await ctx.db.insert('auditLog', {
      adminId: userId,
      action:
        args.publish && !wasPublished
          ? 'article-published'
          : !args.publish && wasPublished
            ? 'article-unpublished'
            : 'article-saved',
      details: `Artigo "${title}" (${id}).`,
    });
    return id;
  },
});

// Hides or shows an article in Explorar without editing it.
export const setPublished = mutation({
  args: { id: v.id('educationalContent'), isPublished: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const article = await ctx.db.get(args.id);
    if (!article) throw new Error('Artigo não encontrado.');
    if (article.isPublished === args.isPublished) return null;
    if (args.isPublished && (!article.summary.trim() || !article.content.trim())) {
      throw new Error('Para publicar, preenche o resumo e o texto.');
    }
    await ctx.db.patch(args.id, { isPublished: args.isPublished, updatedAt: Date.now() });
    await ctx.db.insert('auditLog', {
      adminId: userId,
      action: args.isPublished ? 'article-published' : 'article-unpublished',
      details: `Artigo "${article.title}" (${args.id}).`,
    });
    return null;
  },
});
