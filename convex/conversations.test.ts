/// <reference types="vite/client" />
import { describe, it, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  // Scheduled functions (summaries, notifications) run only when a test drains them.
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const patientId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const proId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: patientId, role: 'patient' });
    await ctx.db.insert('userProfiles', { userId: proId, role: 'professional' });
    const proConvId = await ctx.db.insert('conversations', {
      patientId,
      topic: 'contraception',
      title: 'Contraceção — nova conversa',
      priority: 'high',
      status: 'waiting',
      lastMessageAt: 0,
      kind: 'human-async',
    });
    await ctx.db.insert('messages', {
      conversationId: proConvId,
      senderId: patientId,
      content: 'Questionário de triagem concluído.',
      messageType: 'triage-response',
      metadata: { triageData: { topic: 'contraception', responses: { q1: 'no' }, riskLevel: 'medium' } },
    });
    return { patientId, proId, proConvId };
  });
  const patient = t.withIdentity({ subject: `${ids.patientId}|s1` });
  const pro = t.withIdentity({ subject: `${ids.proId}|s2` });
  return { t, patient, pro, ...ids };
}

describe('switchMode', () => {
  it('creates an AI side chat carrying context, then returns to the same professional chat', async () => {
    const { t, patient, proConvId } = await setup();

    const toAi = await patient.mutation(api.conversations.switchMode, { id: proConvId });
    expect(toAi.created).toBe(true);

    const aiConv = await t.run((ctx) => ctx.db.get(toAi.id));
    expect(aiConv).toMatchObject({
      kind: 'ai-only',
      status: 'active',
      contextConversationId: proConvId,
      counterpartConversationId: proConvId,
    });
    const aiMessages = await t.run((ctx) =>
      ctx.db.query('messages').withIndex('by_conversation', (q) => q.eq('conversationId', toAi.id)).collect()
    );
    expect(aiMessages.some((m) => m.metadata?.triageData)).toBe(true);

    // Second toggle from the professional chat reuses the open AI chat.
    const again = await patient.mutation(api.conversations.switchMode, { id: proConvId });
    expect(again).toEqual({ id: toAi.id, created: false });

    // From the AI chat, "Falar com profissional" goes back to the original.
    const back = await patient.mutation(api.conversations.switchMode, { id: toAi.id });
    expect(back).toEqual({ id: proConvId, created: false });
  });

  it('creates a new professional conversation from a standalone AI chat', async () => {
    const { t, patient, patientId } = await setup();
    const aiId = await t.run((ctx) =>
      ctx.db.insert('conversations', {
        patientId,
        topic: 'general',
        title: 'Conversa com AI',
        priority: 'low',
        status: 'active',
        lastMessageAt: 0,
        kind: 'ai-only',
      })
    );
    const res = await patient.mutation(api.conversations.switchMode, { id: aiId });
    expect(res.created).toBe(true);
    const proConv = await t.run((ctx) => ctx.db.get(res.id));
    expect(proConv).toMatchObject({
      kind: 'human-async',
      status: 'waiting',
      contextConversationId: aiId,
    });
    expect(proConv?.aiHandoffRequestedAt).toBeTypeOf('number');
  });

  it("rejects another user's conversation", async () => {
    const { pro, proConvId } = await setup();
    await expect(pro.mutation(api.conversations.switchMode, { id: proConvId })).rejects.toThrow(
      'Unauthorized'
    );
  });
});

describe('AI chat conversion', () => {
  it('AI escalation converts the side chat and closes the professional chat', async () => {
    const { t, patient, proConvId } = await setup();
    const { id: aiId } = await patient.mutation(api.conversations.switchMode, { id: proConvId });

    await t.mutation(internal.conversations.escalateAiConversation, { conversationId: aiId });

    const [ai, old] = await t.run(async (ctx) => [await ctx.db.get(aiId), await ctx.db.get(proConvId)]);
    expect(ai).toMatchObject({
      kind: 'human-async',
      status: 'waiting',
      priority: 'high', // carried from the professional chat
      contextConversationId: proConvId,
    });
    expect(ai?.counterpartConversationId).toBeUndefined();
    expect(old).toMatchObject({ status: 'closed', closureReason: 'continued-elsewhere' });
  });

  it('a professional intervening (assign) takes over the AI chat', async () => {
    const { t, patient, pro, proId, proConvId } = await setup();
    const { id: aiId } = await patient.mutation(api.conversations.switchMode, { id: proConvId });

    await pro.mutation(api.conversations.assign, { id: aiId });

    const [ai, old] = await t.run(async (ctx) => [await ctx.db.get(aiId), await ctx.db.get(proConvId)]);
    expect(ai).toMatchObject({ kind: 'human-async', status: 'active', professionalId: proId });
    expect(old?.status).toBe('closed');
  });

  it('a professional message in the AI chat takes it over', async () => {
    const { t, patient, pro, proId, proConvId } = await setup();
    const { id: aiId } = await patient.mutation(api.conversations.switchMode, { id: proConvId });

    await pro.mutation(api.messages.send, { conversationId: aiId, content: 'Olá, sou a Dra. Ana.' });

    const ai = await t.run((ctx) => ctx.db.get(aiId));
    expect(ai).toMatchObject({ kind: 'human-async', professionalId: proId });
    // Run the scheduled push notification before teardown.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});

describe('ending conversations', () => {
  it('the patient can end their own conversation; it moves to their history', async () => {
    const { t, patient, proConvId } = await setup();

    await patient.mutation(api.conversations.close, { id: proConvId });

    const conv = await t.run((ctx) => ctx.db.get(proConvId));
    expect(conv).toMatchObject({ status: 'closed', closureReason: 'resolved' });
    const history = await patient.query(api.conversations.listHistory, {});
    expect(history.map((c) => c._id)).toEqual([proConvId]);
  });

  it("another patient can't end someone else's conversation", async () => {
    const { t, proConvId } = await setup();
    const otherId = await t.run(async (ctx) => {
      const id = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: id, role: 'patient' });
      return id;
    });
    const other = t.withIdentity({ subject: `${otherId}|s3` });
    await expect(other.mutation(api.conversations.close, { id: proConvId })).rejects.toThrow(
      'Unauthorized'
    );
  });

  it('closed conversations leave the queue and appear in the professional history', async () => {
    const { t, pro, proConvId } = await setup();
    await pro.mutation(api.conversations.assign, { id: proConvId });
    expect((await pro.query(api.conversations.listForProfessional, { scope: 'all' })).length).toBe(1);

    await pro.mutation(api.conversations.close, { id: proConvId });

    expect(await pro.query(api.conversations.listForProfessional, { scope: 'all' })).toEqual([]);
    const history = await pro.query(api.conversations.listHistory, {});
    expect(history.map((c) => c._id)).toEqual([proConvId]);
    // Run the scheduled AI summary (no config here → logs and exits) inside
    // the test instead of after teardown.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});

describe('one open professional conversation per topic', () => {
  it('create returns the open professional conversation for the same topic', async () => {
    const { patient, proConvId } = await setup();
    const id = await patient.mutation(api.conversations.create, {
      topic: 'contraception',
      title: 'Contraceção — nova conversa',
    });
    expect(id).toBe(proConvId);
  });

  it('create starts a new one for another topic, after closing, or for AI', async () => {
    const { t, patient, proConvId } = await setup();
    const other = await patient.mutation(api.conversations.create, {
      topic: 'sti',
      title: 'IST — nova conversa',
    });
    expect(other).not.toBe(proConvId);

    const ai = await patient.mutation(api.conversations.create, {
      topic: 'contraception',
      title: 'Contraceção — IA',
      kind: 'ai-only',
    });
    expect(ai).not.toBe(proConvId);

    await t.run((ctx) => ctx.db.patch(proConvId, { status: 'closed' }));
    const fresh = await patient.mutation(api.conversations.create, {
      topic: 'contraception',
      title: 'Contraceção — nova conversa',
    });
    expect(fresh).not.toBe(proConvId);
  });

  it('openProfessionalByTopic maps topics to open professional conversations only', async () => {
    const { patient, proConvId } = await setup();
    await patient.mutation(api.conversations.create, {
      topic: 'sti',
      title: 'IST — IA',
      kind: 'ai-only',
    });
    const map = await patient.query(api.conversations.openProfessionalByTopic, {});
    expect(map).toEqual({ contraception: proConvId });
  });
});

describe('switchMode to professional with an open professional conversation', () => {
  it('returns the open one on the same topic instead of creating another', async () => {
    const { t, patient, proConvId, patientId } = await setup();
    const aiId = await t.run((ctx) =>
      ctx.db.insert('conversations', {
        patientId,
        topic: 'contraception',
        title: 'Conversa com AI',
        priority: 'low',
        status: 'active',
        lastMessageAt: 0,
        kind: 'ai-only',
      })
    );
    const res = await patient.mutation(api.conversations.switchMode, { id: aiId });
    expect(res).toEqual({ id: proConvId, created: false });
    const ai = await t.run((ctx) => ctx.db.get(aiId));
    expect(ai?.counterpartConversationId).toBe(proConvId);
  });
});
