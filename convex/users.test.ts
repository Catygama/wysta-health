/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

async function newUser(t: ReturnType<typeof convexTest>) {
  const userId = (await t.run((ctx) => ctx.db.insert('users', {}))) as Id<'users'>;
  return { as: t.withIdentity({ subject: userId as string }), userId };
}

describe('ensureProfile', () => {
  it('creates a patient profile', async () => {
    const t = convexTest(schema, modules);
    const { as } = await newUser(t);
    const profile = await as.mutation(api.users.ensureProfile, {});
    expect(profile?.role).toBe('patient');
  });

  it('does not let the client pick a privileged role', async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await newUser(t);
    for (const role of ['admin', 'professional']) {
      await expect(
        // @ts-expect-error role is no longer an accepted argument
        as.mutation(api.users.ensureProfile, { role })
      ).rejects.toThrow();
    }
    const profiles = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
    );
    expect(profiles).toHaveLength(0);
  });
});
