// GDPR rights for patients: a copy of their data (export) and erasure of the
// account (delete). Only the patient's own data, derived from the session.
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { Id } from './_generated/dataModel';
import { userError, NOT_AUTHENTICATED } from './lib/errors';

const MAX_CONVERSATIONS = 500;
const MAX_MESSAGES_PER_CONVERSATION = 2000;

async function patientOrThrow(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw userError(NOT_AUTHENTICATED);
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (profile && profile.role !== 'patient') {
    throw userError('Esta opção é para utentes. Contacta a administração para gerir a tua conta.');
  }
  return { userId, profile };
}

// Everything the patient can see about herself, as plain JSON. Internal notes
// written by professionals and the AI summaries prepared for them are not
// part of what she sees in the app, so they are left out (see the report).
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await patientOrThrow(ctx);
    const user = await ctx.db.get(userId);
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', userId))
      .take(MAX_CONVERSATIONS);
    const conversationsOut = [];
    for (const c of conversations) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .take(MAX_MESSAGES_PER_CONVERSATION);
      const visible = messages.filter((m) => !m.isInternal && !m.streaming);
      const triage = visible.find((m) => m.metadata?.triageData)?.metadata?.triageData;
      conversationsOut.push({
        tema: c.topic,
        titulo: c.title,
        tipo: c.kind === 'ai-only' ? 'assistente IA' : 'profissional de saúde',
        estado: c.status,
        criadaEm: new Date(c._creationTime).toISOString(),
        respostasDaTriagem: triage?.responses ?? null,
        nivelDeAlerta: c.alertLevel ?? null,
        mensagens: await Promise.all(
          visible
            .filter((m) => m.messageType !== 'triage-response')
            .map(async (m) => ({
              data: new Date(m._creationTime).toISOString(),
              autor:
                m.messageType === 'ai-response'
                  ? 'assistente IA'
                  : m.messageType === 'system'
                    ? 'sistema'
                    : m.senderId === userId
                      ? 'eu'
                      : 'profissional de saúde',
              texto: m.content,
              anexo: m.imageId || m.attachmentId
                ? {
                    nome: m.attachmentName ?? (m.imageId ? 'imagem' : 'documento'),
                    ligacao: await ctx.storage.getUrl((m.imageId ?? m.attachmentId)!),
                  }
                : undefined,
            })),
        ),
      });
    }
    const checkins = await ctx.db
      .query('wellbeingCheckins')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(1000);
    return {
      exportadoEm: new Date().toISOString(),
      conta: { email: user?.email ?? null, criadaEm: user ? new Date(user._creationTime).toISOString() : null },
      perfil: profile
        ? {
            nome: profile.displayName ?? null,
            faixaEtaria: profile.ageRange ?? null,
            localidade: profile.location ?? null,
            condicoes: profile.conditions ?? [],
            medicacao: profile.medications ?? [],
            convidada: profile.isGuest ?? false,
          }
        : null,
      conversas: conversationsOut,
      registosDeBemEstar: checkins.map((c) => ({
        data: new Date(c._creationTime).toISOString(),
        desejo: c.desire,
        satisfacao: c.satisfaction,
        dor: c.pain,
        malEstar: c.distress,
        nota: c.note ?? null,
      })),
    };
  },
});

// Erases the patient's account. Deleted: profile, conversations, all their
// messages (internal notes included), attached files, wellbeing check-ins,
// push tokens, sign-in accounts and sessions. Kept but anonymised: the audit
// log (who did what, when, for accountability) loses the link to the
// conversation and any free text; AI usage rows keep only cost metrics.
export const deleteMyAccount = mutation({
  args: { confirmation: v.literal('APAGAR') },
  handler: async (ctx) => {
    const { userId, profile } = await patientOrThrow(ctx);

    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_patient', (q) => q.eq('patientId', userId))
      .take(MAX_CONVERSATIONS);
    for (const c of conversations) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .take(MAX_MESSAGES_PER_CONVERSATION);
      for (const m of messages) {
        for (const fileId of [m.imageId, m.attachmentId]) {
          if (fileId && (await ctx.db.system.get(fileId))) await ctx.storage.delete(fileId);
        }
        await ctx.db.delete(m._id);
      }
      for (const entry of await ctx.db
        .query('auditLog')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .take(1000)) {
        await ctx.db.patch(entry._id, { conversationId: undefined, details: 'Conta da utente apagada.' });
      }
      for (const inv of await ctx.db
        .query('aiInvocations')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .take(5000)) {
        await ctx.db.patch(inv._id, { conversationId: undefined, userId: undefined });
      }
      await ctx.db.delete(c._id);
    }

    for (const inv of await ctx.db
      .query('aiInvocations')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(5000)) {
      await ctx.db.patch(inv._id, { userId: undefined });
    }
    for (const c of await ctx.db
      .query('wellbeingCheckins')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(1000)) {
      await ctx.db.delete(c._id);
    }
    if (profile) await ctx.db.delete(profile._id);

    // Sign-in data: sessions (and their refresh tokens) and accounts.
    for (const s of await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .take(500)) {
      for (const t of await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', s._id))
        .take(1000)) {
        await ctx.db.delete(t._id);
      }
      await ctx.db.delete(s._id);
    }
    for (const a of await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId as Id<'users'>))
      .take(50)) {
      for (const code of await ctx.db
        .query('authVerificationCodes')
        .withIndex('accountId', (q) => q.eq('accountId', a._id))
        .take(50)) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(userId);
    return null;
  },
});
