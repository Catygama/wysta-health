/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// Vite normalises import.meta.glob paths relative to the test file's directory.
// Files in convex/lib/ appear as './foo.ts' (not '../lib/foo.ts').
// convex-test derives the module prefix from the _generated directory path
// ('../_generated/...'), which gives prefix '../'. So it looks for
// '../lib/authProbe' but Vite stored it as './authProbe'.
// Fix: remap keys so all paths share the same '../' prefix.
function buildModules(): Record<string, () => Promise<unknown>> {
  const raw = import.meta.glob('../**/*.ts');
  const local = import.meta.glob('./**/*.ts');

  const result: Record<string, () => Promise<unknown>> = { ...raw };
  for (const [k, v] of Object.entries(local)) {
    // './foo.ts' → '../lib/foo.ts'
    const remapped = k.replace(/^\.\//, '../lib/');
    result[remapped] = v;
  }
  return result;
}

const modules = buildModules();

describe('requireAdmin', () => {
  it('throws when caller is not authenticated', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.lib.authProbe.run, {})
    ).rejects.toThrow(/sessão terminou/i);
  });

  it('throws when caller has no profile', async () => {
    const t = convexTest(schema, modules);
    // Insert a real users row first so getAuthUserId can resolve it.
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    // Create identity whose subject IS the users._id so getAuthUserId returns it.
    const asUser = t.withIdentity({ subject: userId as string });
    // No userProfiles row — requireAdmin should throw "admin only".
    await expect(
      asUser.mutation(internal.lib.authProbe.run, {})
    ).rejects.toThrow(/admin/i);
  });

  it('throws when caller is not admin', async () => {
    const t = convexTest(schema, modules);
    // Insert a users row, then link a patient profile to it.
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    const asUser = t.withIdentity({ subject: userId as string });
    await asUser.run(async (ctx) => {
      await ctx.db.insert('userProfiles', { userId, role: 'patient' });
    });
    await expect(
      asUser.mutation(internal.lib.authProbe.run, {})
    ).rejects.toThrow(/admin/i);
  });

  it('returns userId + profile when caller is admin', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {} as any) as Promise<Id<'users'>>;
    });
    const asUser = t.withIdentity({ subject: userId as string });
    await asUser.run(async (ctx) => {
      await ctx.db.insert('userProfiles', { userId, role: 'admin' });
    });
    const result = await asUser.mutation(internal.lib.authProbe.run, {});
    expect(result.role).toBe('admin');
  });
});
