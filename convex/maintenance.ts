import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { CHAT_CLOSING_RULE } from './ai/defaults';
import { toNurseWording } from './lib/nurseWording';
import type { Doc } from './_generated/dataModel';

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

// One-off: the stored global chat prompt told the AI to always end with
// "espera pela resposta do profissional", even with no professional involved.
// Inserts a new prompt version (history kept) with that rule replaced by
// CHAT_CLOSING_RULE, leaving any other admin edits intact.
// Run: "bunx convex run maintenance:updateChatClosingRule" (add --prod for prod).
export const updateChatClosingRule = internalMutation({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db
      .query('aiPrompts')
      .withIndex('by_purpose_and_topic', (q) => q.eq('purpose', 'chat').eq('topic', undefined))
      .order('desc')
      .first();
    if (!current) return { updated: false, reason: 'sem prompt de chat' };
    const old =
      '- Termina sempre com a frase: "Para a tua situação concreta, espera\n' +
      '  pela resposta do profissional ou marca consulta presencial."';
    if (!current.systemPrompt.includes(old)) {
      return { updated: false, reason: 'regra antiga não encontrada (prompt já alterado?)' };
    }
    await ctx.db.insert('aiPrompts', {
      purpose: current.purpose,
      topic: current.topic,
      systemPrompt: current.systemPrompt.replace(old, CHAT_CLOSING_RULE.join('\n')),
      userTemplate: current.userTemplate,
      temperature: current.temperature,
      maxTokens: current.maxTokens,
      notes: 'frase final só quando há profissional em curso',
      createdBy: current.createdBy,
    });
    return { updated: true };
  },
});

// One-off: the app now says "enfermeiro" for the health professional. Inserts
// a new version (history kept) of every stored prompt that still says
// "profissional", with the same rewording as the defaults (lib/nurseWording).
// The context line the chat prompt reads is now "Enfermeiro:", so run this
// right after deploying.
// Run: "bunx convex run maintenance:useNurseWording" (add --prod for prod),
// with '{"dryRun": true}' first to only list what would change.
export const useNurseWording = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    // Latest version per purpose + topic (versions are rows; newest wins).
    const latest = new Map<string, Doc<'aiPrompts'>>();
    for (const p of await ctx.db.query('aiPrompts').order('desc').take(2000)) {
      const key = `${p.purpose}/${p.topic ?? ''}`;
      if (!latest.has(key)) latest.set(key, p);
    }
    const updated: string[] = [];
    for (const [key, p] of latest) {
      const systemPrompt = toNurseWording(p.systemPrompt);
      const userTemplate = p.userTemplate === undefined ? undefined : toNurseWording(p.userTemplate);
      if (systemPrompt === p.systemPrompt && userTemplate === p.userTemplate) continue;
      updated.push(key);
      if (dryRun) continue;
      await ctx.db.insert('aiPrompts', {
        purpose: p.purpose,
        topic: p.topic,
        systemPrompt,
        userTemplate,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        notes: '"profissional" passa a "enfermeiro"',
        createdBy: p.createdBy,
      });
    }
    return { updated, dryRun: !!dryRun };
  },
});
