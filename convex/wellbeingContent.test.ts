/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ARTICLE_SEEDS } from './lib/seedData';

const modules = import.meta.glob('./**/*.ts');

describe('sexual-wellbeing content', () => {
  it('ARTICLE_SEEDS has at least 5 sexual-wellbeing articles', () => {
    const count = ARTICLE_SEEDS.filter((a) => a.topic === 'sexual-wellbeing').length;
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('seedAll publishes them; listByTopic returns them', async () => {
    const t = convexTest(schema, modules);
    // No admin exists yet → seedAll allows the first authenticated caller.
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    const asUser = t.withIdentity({ subject: userId as string });
    await asUser.mutation(api.seed.seedAll, {});
    const articles = await t.query(api.education.listByTopic, {
      topic: 'sexual-wellbeing',
    });
    expect(articles.length).toBeGreaterThanOrEqual(5);
    expect(articles.every((a) => a.isPublished)).toBe(true);
  });
});
