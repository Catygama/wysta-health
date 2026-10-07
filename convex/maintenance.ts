import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

// One-off cleanup: before AI chats became read-only context, an escalated or
// taken-over AI chat was converted in place into a professional conversation
// (kind 'human-async', aiHandoffRequestedAt set, title still 'Conversa com AI').
// Those legacy requests clutter the queue; this closes the open ones.
// Run from the CLI: "bunx convex run maintenance:closeLegacyAiConversions"
// with '{"dryRun": true}' first to only count them (add --prod for prod).
export const closeLegacyAiConversions = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    let closed = 0;
    for await (const c of ctx.db.query('conversations')) {
      const legacy =
        c.kind === 'human-async' &&
        c.aiHandoffRequestedAt !== undefined &&
        c.title === 'Conversa com AI' &&
        c.status !== 'closed';
      if (!legacy) continue;
      closed++;
      if (dryRun) continue;
      await ctx.db.patch(c._id, {
        status: 'closed',
        closureReason: 'continued-elsewhere',
        lastMessageAt: Date.now(),
      });
      // The audit log needs a professional; unassigned ones are only closed.
      if (c.professionalId) {
        await ctx.db.insert('auditLog', {
          conversationId: c._id,
          professionalId: c.professionalId,
          action: 'closure',
          details: 'Encerrada: conversa com AI convertida pela regra antiga',
        });
      }
    }
    return { closed, dryRun: !!dryRun };
  },
});
