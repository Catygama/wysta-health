// Minimal pseudonymisation of what goes to the language model: the patient's
// name and email are replaced in every text (messages typed by her or by the
// professional, summaries), so the provider gets the clinical content without
// her identity. Profile context already carries only age range, conditions and
// medication.
import { v } from 'convex/values';
import { internalQuery } from '../_generated/server';

export type Identity = { names: string[]; email?: string };

export const identityFor = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<Identity> => {
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const full = profile?.displayName?.trim() ?? '';
    // The full name and each part of it ("Inês Silva" and "Inês", "Silva").
    const parts = full.split(/\s+/).filter((p) => p.length >= 3);
    const names = [...new Set([full, ...parts].filter(Boolean))].sort((a, b) => b.length - a.length);
    return { names, email: user?.email ?? undefined };
  },
});

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function pseudonymize(text: string, id: Identity): string {
  let out = text;
  if (id.email) out = out.replace(new RegExp(escape(id.email), 'gi'), '[email]');
  for (const name of id.names) {
    // Whole words only, accents included ("Inês" but not "Inesperado").
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu'), '[nome]');
  }
  return out;
}
