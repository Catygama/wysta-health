/// <reference types="vite/client" />
import { describe, it, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { TRIAGE_SEEDS } from './lib/seedData';

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
    await ctx.db.insert('userProfiles', { userId: proId, role: 'professional', professionalVerificationStatus: 'verified' });
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

describe('AI chats are read-only context for professionals', () => {
  it('AI escalation forwards to the professional chat and leaves the AI chat as is', async () => {
    const { t, patient, proConvId } = await setup();
    await t.run((ctx) => ctx.db.patch(proConvId, { priority: 'low' }));
    const { id: aiId } = await patient.mutation(api.conversations.switchMode, { id: proConvId });

    await t.mutation(internal.conversations.escalateAiConversation, { conversationId: aiId });

    const [ai, pro] = await t.run(async (ctx) => [await ctx.db.get(aiId), await ctx.db.get(proConvId)]);
    expect(ai).toMatchObject({ kind: 'ai-only', status: 'active' });
    expect(pro).toMatchObject({ kind: 'human-async', status: 'waiting', priority: 'high' });
    const proMessages = await t.run((ctx) =>
      ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', proConvId))
        .collect()
    );
    expect(proMessages.some((m) => m.messageType === 'system' && m.content.includes('encaminhada'))).toBe(true);
  });

  it('professionals cannot take over or write in an AI chat', async () => {
    const { patient, pro, proConvId } = await setup();
    const { id: aiId } = await patient.mutation(api.conversations.switchMode, { id: proConvId });
    await expect(pro.mutation(api.conversations.assign, { id: aiId })).rejects.toThrow();
    await expect(
      pro.mutation(api.messages.send, { conversationId: aiId, content: 'Olá' })
    ).rejects.toThrow();
  });

  it('AI chats never appear in the queue; requests from AI chats are flagged', async () => {
    const { t, patient, pro, patientId } = await setup();
    const aiId = await t.run((ctx) =>
      ctx.db.insert('conversations', {
        patientId,
        topic: 'sti',
        title: 'Conversa com AI',
        priority: 'low',
        status: 'active',
        lastMessageAt: 0,
        kind: 'ai-only',
      })
    );
    const { id: requestId } = await patient.mutation(api.conversations.switchMode, { id: aiId });

    const queue = await pro.query(api.conversations.listForProfessional, { scope: 'unassigned' });
    expect(queue.some((c) => c._id === aiId)).toBe(false);
    expect(queue.find((c) => c._id === requestId)?.fromAi).toBe(true);
  });

  it('only the assigned professional (or anyone while unassigned) reads the linked AI chat', async () => {
    const { t, patient, pro, proId, patientId } = await setup();
    const otherId = await t.run(async (ctx) => {
      const id = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: id, role: 'professional', professionalVerificationStatus: 'verified' });
      return id;
    });
    const other = t.withIdentity({ subject: `${otherId}|s3` });
    const aiId = await t.run((ctx) =>
      ctx.db.insert('conversations', {
        patientId,
        topic: 'sti',
        title: 'Conversa com AI',
        priority: 'low',
        status: 'active',
        lastMessageAt: 0,
        kind: 'ai-only',
      })
    );
    await t.run((ctx) =>
      ctx.db.insert('messages', {
        conversationId: aiId,
        senderId: patientId,
        content: 'Tenho ardor ao urinar',
        messageType: 'text',
      })
    );
    const { id: requestId } = await patient.mutation(api.conversations.switchMode, { id: aiId });

    // Unassigned request: any professional can read the AI context.
    expect((await other.query(api.messages.list, { conversationId: aiId })).length).toBeGreaterThan(0);

    await pro.mutation(api.conversations.assign, { id: requestId });
    const context = await pro.query(api.conversations.aiContext, { id: requestId });
    expect(context).toHaveLength(1);
    expect(context[0]).toMatchObject({ conversationId: aiId, relation: 'before' });
    expect(context[0].messages.map((m) => m.content)).toContain('Tenho ardor ao urinar');

    // Assigned to someone else: no access.
    expect(await other.query(api.messages.list, { conversationId: aiId })).toEqual([]);
    expect(await other.query(api.conversations.get, { id: aiId })).toBeNull();
    expect(await other.query(api.conversations.aiContext, { id: requestId })).toEqual([]);
    expect(proId).toBeDefined();
  });

  it("an AI chat that isn't linked to any professional conversation stays private", async () => {
    const { t, pro, patientId } = await setup();
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
    expect(await pro.query(api.conversations.get, { id: aiId })).toBeNull();
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

describe('triage alert levels', () => {
  async function seedTriage(t: Awaited<ReturnType<typeof setup>>['t']) {
    await t.run(async (ctx) => {
      for (const seed of TRIAGE_SEEDS) await ctx.db.insert('triageQuestions', seed);
    });
  }

  it('create recomputes the most severe level from the answers and sets the priority', async () => {
    const { t, patient } = await setup();
    await seedTriage(t);
    const id = await patient.mutation(api.conversations.create, {
      topic: 'pregnancy',
      title: 'Gravidez — nova conversa',
      triageData: {
        responses: { weeks: '24 semanas ou mais', bleeding: 'no', 'abdominal-pain': 'yes', 'reduced-movement': 'yes' },
      },
    });
    const conv = await t.run((ctx) => ctx.db.get(id));
    expect(conv?.alertLevel).toBe('emergency');
    expect(conv?.priority).toBe('urgent');
  });

  it('time-sensitive and priority answers raise the conversation to high, without a level change to urgent', async () => {
    const { t, patient } = await setup();
    await seedTriage(t);
    const id = await patient.mutation(api.conversations.create, {
      topic: 'sti',
      title: 'IST — nova conversa',
      triageData: { responses: { discharge: 'no', lesions: 'yes', 'urination-pain': 'no', 'fever-pain': 'no' } },
    });
    const conv = await t.run((ctx) => ctx.db.get(id));
    expect(conv?.alertLevel).toBe('priority');
    expect(conv?.priority).toBe('high');
  });

  it('the professional queue lists the most severe level first, oldest first within a level', async () => {
    const { t, patient, pro } = await setup();
    await seedTriage(t);
    await patient.mutation(api.conversations.create, {
      topic: 'sti',
      title: 'IST',
      triageData: { responses: { lesions: 'yes' } },
    });
    await patient.mutation(api.conversations.create, {
      topic: 'pregnancy',
      title: 'Gravidez',
      triageData: { responses: { bleeding: 'yes' } },
    });
    await patient.mutation(api.conversations.create, {
      topic: 'menstrual-cycle',
      title: 'Ciclo',
      triageData: { responses: { 'pain-intensity': 9 } },
    });
    const queue = await pro.query(api.conversations.listForProfessional, {});
    // The setup's contraception conversation (priority 'high', no level) ranks
    // with 'priority' and is older than the STI one.
    expect(queue.map((c) => c.title)).toEqual(['Gravidez', 'Ciclo', 'Contraceção — nova conversa', 'IST']);
  });
});

describe('recommend in person', () => {
  it("sends the professional's own message and notifies the patient", async () => {
    const { t, pro, proConvId, proId } = await setup();
    await t.run((ctx) => ctx.db.patch(proConvId, { professionalId: proId, status: 'active' }));
    await pro.mutation(api.conversations.recommendInPerson, { id: proConvId, extraNote: 'Vai ao centro de saúde.' });
    const messages = await t.run((ctx) =>
      ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', proConvId))
        .collect()
    );
    const last = messages[messages.length - 1];
    expect(last).toMatchObject({ senderId: proId, messageType: 'text' });
    expect(last.content).toContain('SNS 24');
    expect(last.content.endsWith('Vai ao centro de saúde.')).toBe(true);
    expect(last.content).not.toContain('Nota do profissional');
    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
    expect(scheduled.some((s) => s.name.includes('notifications'))).toBe(true);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});
