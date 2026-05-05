// Public action that generates an AI summary for a conversation. Only the
// assigned professional or an admin may trigger it. The output is persisted
// on `conversations.aiSummary` and not duplicated in `aiInvocations` (RGPD
// data minimisation — input is reconstructable via conversationId + messages).

import { action, internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { runAgent } from './runAgent';

export const generate = action({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<{ summary: string; invocationId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const access = await ctx.runQuery(internal.ai.chatSummary.assertAccess, {
      conversationId,
      userId,
    });
    if (!access.allowed) {
      throw new Error('Only the assigned professional or an admin can generate summaries');
    }

    const text = renderConversation(access.messages);
    const result = await runAgent(ctx, {
      purpose: 'chat-summary',
      vars: { conversationText: text },
      userId,
      conversationId,
    });

    await ctx.runMutation(internal.ai.chatSummary.storeSummary, {
      conversationId,
      summary: result.output,
    });

    return { summary: result.output, invocationId: result.invocationId };
  },
});

export const assertAccess = internalQuery({
  args: { conversationId: v.id('conversations'), userId: v.id('users') },
  handler: async (ctx, { conversationId, userId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return { allowed: false as const, messages: [] };

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const isAdmin = profile?.role === 'admin';
    const isAssigned = conversation.professionalId === userId;
    if (!isAdmin && !isAssigned) return { allowed: false as const, messages: [] };

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('asc')
      .take(500);

    return {
      allowed: true as const,
      messages: messages
        .filter((m) => !m.isInternal && m.messageType !== 'system')
        .map((m) => ({
          senderId: m.senderId,
          patientId: conversation.patientId,
          content: m.content,
        })),
    };
  },
});

export const storeSummary = internalMutation({
  args: { conversationId: v.id('conversations'), summary: v.string() },
  handler: async (ctx, { conversationId, summary }) => {
    await ctx.db.patch(conversationId, {
      aiSummary: summary,
      aiSummaryAt: Date.now(),
    });
  },
});

// Admin-only freeform invocation for testing prompt + config tweaks without
// needing a real conversation. Cost-bearing — keep guarded.
export const adminTest = action({
  args: { conversationText: v.string() },
  handler: async (ctx, { conversationText }): Promise<{ summary: string; invocationId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const isAdmin = await ctx.runQuery(internal.ai.chatSummary.isCallerAdmin, { userId });
    if (!isAdmin) throw new Error('Admin only');
    const result = await runAgent(ctx, {
      purpose: 'chat-summary',
      vars: { conversationText },
      userId,
    });
    return { summary: result.output, invocationId: result.invocationId };
  },
});

export const isCallerAdmin = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return profile?.role === 'admin';
  },
});

function renderConversation(
  messages: Array<{ senderId: string; patientId: string; content: string }>
): string {
  const lines = messages.map((m) => {
    const role = m.senderId === m.patientId ? 'Utente' : 'Profissional';
    return `${role}: ${m.content}`;
  });
  return lines.join('\n');
}
