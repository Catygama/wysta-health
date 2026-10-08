/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const patientId = (await ctx.db.insert('users', { email: 'ines@exemplo.pt' } as any)) as Id<'users'>;
    const otherId = (await ctx.db.insert('users', { email: 'outra@exemplo.pt' } as any)) as Id<'users'>;
    const nurseId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', {
      userId: patientId, role: 'patient', displayName: 'Inês', ageRange: '26-35', conditions: ['Asma'],
      aiSummary: 'Resumo para profissionais',
    });
    await ctx.db.insert('userProfiles', { userId: otherId, role: 'patient' });
    await ctx.db.insert('userProfiles', { userId: nurseId, role: 'professional', professionalVerificationStatus: 'verified' });
    const convId = await ctx.db.insert('conversations', {
      patientId, professionalId: nurseId, topic: 'contraception', title: 'Contraceção', priority: 'low',
      status: 'active', lastMessageAt: 0, kind: 'human-async', alertLevel: 'time-sensitive', aiSummary: 'Sumário',
    });
    const otherConv = await ctx.db.insert('conversations', {
      patientId: otherId, topic: 'sti', title: 'IST', priority: 'low', status: 'waiting', lastMessageAt: 0,
    });
    const fileId = await ctx.storage.store(new Blob(['foto']));
    await ctx.db.insert('messages', {
      conversationId: convId, senderId: patientId, content: 'Questionário de triagem concluído.', messageType: 'triage-response',
      metadata: { triageData: { topic: 'contraception', responses: { unprotected: 'yes' }, riskLevel: 'medium' } },
    });
    await ctx.db.insert('messages', { conversationId: convId, senderId: patientId, content: 'Olá', messageType: 'text' });
    await ctx.db.insert('messages', { conversationId: convId, senderId: patientId, content: 'Foto', messageType: 'image', imageId: fileId });
    await ctx.db.insert('messages', { conversationId: convId, senderId: nurseId, content: 'Resposta', messageType: 'text' });
    await ctx.db.insert('messages', { conversationId: convId, senderId: nurseId, content: 'Nota interna', messageType: 'text', isInternal: true });
    await ctx.db.insert('messages', { conversationId: otherConv, senderId: otherId, content: 'Da outra', messageType: 'text' });
    await ctx.db.insert('wellbeingCheckins', { userId: patientId, desire: 3, satisfaction: 4, pain: 1, distress: 2 });
    await ctx.db.insert('auditLog', { conversationId: convId, professionalId: nurseId, action: 'redirect-recommended', details: 'nota clínica livre' });
    const sessionId = await ctx.db.insert('authSessions', { userId: patientId, expirationTime: Date.now() + 1e6 } as any);
    await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: Date.now() + 1e6 } as any);
    await ctx.db.insert('authAccounts', { userId: patientId, provider: 'password', providerAccountId: 'ines@exemplo.pt' } as any);
    return { patientId, otherId, nurseId, convId, otherConv, fileId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: `${id}|s` });
  return { t, ...ids, patient: as(ids.patientId), nurse: as(ids.nurseId) };
}

describe('C1: export my data', () => {
  it('contains the profile, conversations, visible messages, triage and wellbeing', async () => {
    const { patient } = await setup();
    const data = await patient.query(api.privacy.exportMyData, {});
    expect(data.conta.email).toBe('ines@exemplo.pt');
    expect(data.perfil).toMatchObject({ nome: 'Inês', faixaEtaria: '26-35', condicoes: ['Asma'] });
    expect(data.conversas).toHaveLength(1);
    const conv = data.conversas[0];
    expect(conv.respostasDaTriagem).toEqual({ unprotected: 'yes' });
    expect(conv.nivelDeAlerta).toBe('time-sensitive');
    expect(conv.mensagens.map((m: any) => [m.autor, m.texto])).toEqual([
      ['eu', 'Olá'], ['eu', 'Foto'], ['profissional de saúde', 'Resposta'],
    ]);
    expect(conv.mensagens[1].anexo.ligacao).toMatch(/^https:/);
    expect(data.registosDeBemEstar).toHaveLength(1);
    const text = JSON.stringify(data);
    expect(text).not.toContain('Nota interna');
    expect(text).not.toContain('Resumo para profissionais');
    expect(text).not.toContain('Da outra');
  });

  it('is for patients only', async () => {
    const { nurse } = await setup();
    await expect(nurse.query(api.privacy.exportMyData, {})).rejects.toThrow('utentes');
  });
});

describe('C2: delete my account', () => {
  it('erases her data and sign-in, anonymises the audit log, keeps others untouched', async () => {
    const { t, patient, patientId, otherId, convId, otherConv, fileId } = await setup();
    await patient.mutation(api.privacy.deleteMyAccount, { confirmation: 'APAGAR' });
    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get(patientId),
      profiles: await ctx.db.query('userProfiles').collect(),
      conv: await ctx.db.get(convId),
      messages: await ctx.db.query('messages').collect(),
      file: await ctx.db.system.get(fileId),
      checkins: await ctx.db.query('wellbeingCheckins').collect(),
      audit: await ctx.db.query('auditLog').collect(),
      sessions: await ctx.db.query('authSessions').collect(),
      tokens: await ctx.db.query('authRefreshTokens').collect(),
      accounts: await ctx.db.query('authAccounts').collect(),
      other: await ctx.db.get(otherConv),
    }));
    expect(state.user).toBeNull();
    expect(state.profiles.some((p) => p.userId === patientId)).toBe(false);
    expect(state.conv).toBeNull();
    expect(state.messages.map((m) => m.content)).toEqual(['Da outra']);
    expect(state.file).toBeNull();
    expect(state.checkins).toEqual([]);
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]).toMatchObject({ action: 'redirect-recommended', details: 'Conta da utente apagada.' });
    expect(state.audit[0].conversationId).toBeUndefined();
    expect([state.sessions, state.tokens, state.accounts]).toEqual([[], [], []]);
    expect(state.other?.patientId).toBe(otherId);
  });

  it('needs the explicit confirmation word', async () => {
    const { patient } = await setup();
    await expect(patient.mutation(api.privacy.deleteMyAccount, { confirmation: 'sim' } as any)).rejects.toThrow();
  });
});
