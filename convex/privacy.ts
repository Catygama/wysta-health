// GDPR rights for patients: a copy of their data (export) and erasure of the
// account (delete). Only the patient's own data, derived from the session.
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { userError, NOT_AUTHENTICATED } from './lib/errors';
import { PRIVACY_POLICY_VERSION } from './lib/privacyVersion';
import { eraseAccount, getActiveUserId } from './lib/accounts';

const MAX_CONVERSATIONS = 500;
const MAX_MESSAGES_PER_CONVERSATION = 2000;

async function patientOrThrow(ctx: QueryCtx | MutationCtx) {
  const userId = await getActiveUserId(ctx);
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

// Records that the signed-in person accepted the current privacy policy, at
// sign-up or when entering without an account. The version must be the one
// the app is showing (a stale app is asked to reload).
export const recordConsent = mutation({
  args: { policyVersion: v.string(), method: v.union(v.literal('registo'), v.literal('sem-conta')) },
  handler: async (ctx, { policyVersion, method }) => {
    const userId = await getActiveUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    if (policyVersion !== PRIVACY_POLICY_VERSION) {
      throw userError('A política de privacidade foi atualizada. Recarrega a página e volta a confirmar.');
    }
    await ctx.db.insert('privacyConsents', { userId, policyVersion, acceptedAt: Date.now(), method });
    return null;
  },
});

// Everything about the patient, as plain JSON (GDPR art. 15). What she sees in
// the app, plus, in a separate section, the internal notes written by the
// nursing team and the AI summaries prepared for them.
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
    const teamNotes: Array<{
      conversa: string;
      tema: string;
      tipo: 'nota interna' | 'resumo de IA da conversa';
      data: string;
      texto: string;
    }> = [];
    for (const c of conversations) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .take(MAX_MESSAGES_PER_CONVERSATION);
      const visible = messages.filter((m) => !m.isInternal && !m.streaming);
      for (const m of messages.filter((m) => m.isInternal)) {
        teamNotes.push({
          conversa: c.title,
          tema: c.topic,
          tipo: 'nota interna',
          data: new Date(m._creationTime).toISOString(),
          texto: m.content,
        });
      }
      if (c.aiSummary) {
        teamNotes.push({
          conversa: c.title,
          tema: c.topic,
          tipo: 'resumo de IA da conversa',
          data: new Date(c.aiSummaryAt ?? c._creationTime).toISOString(),
          texto: c.aiSummary,
        });
      }
      const triage = visible.find((m) => m.metadata?.triageData)?.metadata?.triageData;
      conversationsOut.push({
        tema: c.topic,
        titulo: c.title,
        tipo: c.kind === 'ai-only' ? 'assistente IA' : 'enfermeiro',
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
                      : 'enfermeiro',
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
    const consents = await ctx.db
      .query('privacyConsents')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(100);
    return {
      exportadoEm: new Date().toISOString(),
      consentimentos: consents.map((c) => ({
        versaoDaPolitica: c.policyVersion,
        aceiteEm: new Date(c.acceptedAt).toISOString(),
        forma: c.method === 'registo' ? 'registo' : 'entrada sem conta',
      })),
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
      notasDaEquipaDeEnfermagem: {
        descricao:
          'Notas internas escritas pela equipa de enfermagem e resumos preparados pela assistente de IA para a equipa.',
        resumoDoPerfil: profile?.aiSummary
          ? { data: new Date(profile.aiSummaryAt ?? 0).toISOString(), texto: profile.aiSummary }
          : null,
        notas: teamNotes,
      },
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

// Erases the patient's account (lib/accounts.ts eraseAccount): profile,
// conversations, all their messages (internal notes included), attached files,
// wellbeing check-ins, consents, push tokens, sign-in accounts and sessions.
// Kept but anonymised: the audit log and the AI usage cost metrics.
export const deleteMyAccount = mutation({
  args: { confirmation: v.literal('APAGAR') },
  handler: async (ctx) => {
    const { userId } = await patientOrThrow(ctx);
    await eraseAccount(ctx, userId);
    return null;
  },
});
