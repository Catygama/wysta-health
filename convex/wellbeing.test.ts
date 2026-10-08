/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

async function authed(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
  });
  return { as: t.withIdentity({ subject: userId as string }), userId };
}

describe('wellbeing check-ins', () => {
  it('submitCheckin stores; latestCheckin + listCheckins return it', async () => {
    const t = convexTest(schema, modules);
    const { as } = await authed(t);
    await as.mutation(api.wellbeing.submitCheckin, {
      desire: 3,
      satisfaction: 4,
      pain: 1,
      distress: 2,
    });
    const latest = await as.query(api.wellbeing.latestCheckin, {});
    expect(latest?.desire).toBe(3);
    expect(latest?.satisfaction).toBe(4);
    const list = await as.query(api.wellbeing.listCheckins, {});
    expect(list).toHaveLength(1);
  });

  it('listCheckins returns newest first', async () => {
    const t = convexTest(schema, modules);
    const { as } = await authed(t);
    await as.mutation(api.wellbeing.submitCheckin, {
      desire: 1, satisfaction: 1, pain: 0, distress: 1,
    });
    await as.mutation(api.wellbeing.submitCheckin, {
      desire: 5, satisfaction: 5, pain: 0, distress: 1,
    });
    const list = await as.query(api.wellbeing.listCheckins, {});
    expect(list[0].desire).toBe(5);
  });

  it('submitCheckin rejects out-of-range scores', async () => {
    const t = convexTest(schema, modules);
    const { as } = await authed(t);
    await expect(
      as.mutation(api.wellbeing.submitCheckin, {
        desire: 9, satisfaction: 4, pain: 1, distress: 2,
      })
    ).rejects.toThrow(/Desejo/);
  });

  it('submitCheckin rejects unauthenticated', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.wellbeing.submitCheckin, {
        desire: 3, satisfaction: 3, pain: 0, distress: 1,
      })
    ).rejects.toThrow(/sessão terminou/i);
  });

  it('conversations.create stores wellbeingGoal + ai-only kind', async () => {
    const t = convexTest(schema, modules);
    const { as } = await authed(t);
    const id = await as.mutation(api.conversations.create, {
      topic: 'sexual-wellbeing',
      title: 'Bem-estar sexual — nova conversa',
      wellbeingGoal: 'Prazer e orgasmo',
      kind: 'ai-only',
    });
    const conv = await t.run(async (ctx) => ctx.db.get(id));
    expect(conv?.wellbeingGoal).toBe('Prazer e orgasmo');
    expect(conv?.kind).toBe('ai-only');
    expect(conv?.status).toBe('active');
  });
});
