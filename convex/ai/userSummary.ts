// Aggregated profile summary for a patient: combines structured profile data
// with the AI-generated chat summaries of past conversations. Output is
// persisted on userProfiles.aiSummary and shown to the professional opening
// any conversation with this patient.

import { action, internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { runAgent } from './runAgent';

export const generate = action({
  args: { patientId: v.id('users') },
  handler: async (ctx, { patientId }): Promise<{ summary: string; invocationId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const access = await ctx.runQuery(internal.ai.userSummary.assertAccess, {
      callerId: userId,
      patientId,
    });
    if (!access.allowed) {
      throw new Error('Only professionals or admins can generate user summaries');
    }

    const result = await runAgent(ctx, {
      purpose: 'user-summary',
      vars: {
        profileData: access.profileData,
        conversationSummaries: access.conversationSummaries,
      },
      userId,
    });

    await ctx.runMutation(internal.ai.userSummary.storeSummary, {
      patientId,
      summary: result.output,
    });

    return { summary: result.output, invocationId: result.invocationId };
  },
});

export const assertAccess = internalQuery({
  args: { callerId: v.id('users'), patientId: v.id('users') },
  handler: async (ctx, { callerId, patientId }) => {
    const callerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    const allowed =
      callerProfile?.role === 'admin' || callerProfile?.role === 'professional';
    if (!allowed) {
      return { allowed: false as const, profileData: '', conversationSummaries: '' };
    }

    const patientProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', patientId))
      .unique();

    const profileData = renderProfile(patientProfile);

    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', patientId))
      .order('desc')
      .take(10);
    const summaries = conversations
      .filter((c) => c.aiSummary)
      .map((c) => `[${c.topic}] ${c.aiSummary}`)
      .join('\n\n');
    const conversationSummaries = summaries.length > 0 ? summaries : 'Sem registo.';

    return { allowed: true as const, profileData, conversationSummaries };
  },
});

export const storeSummary = internalMutation({
  args: { patientId: v.id('users'), summary: v.string() },
  handler: async (ctx, { patientId, summary }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', patientId))
      .unique();
    if (!profile) throw new Error('Profile not found');
    await ctx.db.patch(profile._id, {
      aiSummary: summary,
      aiSummaryAt: Date.now(),
    });
  },
});

function renderProfile(p: { ageRange?: string; pregnancyStatus?: string; conditions?: string[]; medications?: string[] } | null): string {
  if (!p) return 'Sem registo.';
  const parts: string[] = [];
  if (p.ageRange) parts.push(`Faixa etária: ${p.ageRange}`);
  if (p.pregnancyStatus) parts.push(`Gravidez: ${p.pregnancyStatus}`);
  if (p.conditions?.length) parts.push(`Condições: ${p.conditions.join(', ')}`);
  if (p.medications?.length) parts.push(`Medicação: ${p.medications.join(', ')}`);
  return parts.length > 0 ? parts.join('\n') : 'Sem dados estruturados registados.';
}
