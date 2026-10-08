/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { SAFETY_RULES } from './lib/aiSafetyMessages';

const modules = import.meta.glob('./**/*.ts');
const fixed = (id: string) => SAFETY_RULES.find((r) => r.id === id)!.message;

// Two waiting conversations with a nurse; the patient writes in the newer,
// lower-priority one.
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const patientId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const otherPatientId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const nurseId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: patientId, role: 'patient' });
    await ctx.db.insert('userProfiles', { userId: otherPatientId, role: 'patient' });
    await ctx.db.insert('userProfiles', {
      userId: nurseId,
      role: 'professional',
      professionalVerificationStatus: 'verified',
    });
    const base = { topic: 'contraception' as const, title: 't', status: 'waiting' as const, lastMessageAt: 0, kind: 'human-async' as const };
    const olderId = await ctx.db.insert('conversations', { ...base, patientId: otherPatientId, priority: 'high' });
    const convId = await ctx.db.insert('conversations', { ...base, patientId, priority: 'low' });
    return { patientId, nurseId, olderId, convId };
  });
  return {
    t,
    ...ids,
    patient: t.withIdentity({ subject: `${ids.patientId}|s1` }),
    nurse: t.withIdentity({ subject: `${ids.nurseId}|s2` }),
  };
}

async function messages(t: Awaited<ReturnType<typeof setup>>['t'], conversationId: Id<'conversations'>) {
  return t.run((ctx) =>
    ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .collect()
  );
}

describe('safety rules on messages to a nurse', () => {
  it('shows the fixed message, keeps the patient message and puts the conversation at the top of the queue', async () => {
    const { t, patient, nurse, convId, olderId } = await setup();
    const before = await nurse.query(api.conversations.listForProfessional, { scope: 'unassigned' });
    expect(before.map((c: any) => c._id)).toEqual([olderId, convId]);

    await patient.mutation(api.messages.send, {
      conversationId: convId,
      content: 'Acho que puseram alguma coisa na minha bebida ontem.',
    });

    const msgs = await messages(t, convId);
    expect(msgs.map((m) => [m.messageType, m.content])).toEqual([
      ['text', 'Acho que puseram alguma coisa na minha bebida ontem.'],
      ['system', fixed('sexual-violence')],
    ]);
    expect(msgs.some((m) => m.messageType === 'ai-response')).toBe(false);
    const conv = await t.run((ctx) => ctx.db.get(convId));
    expect(conv).toMatchObject({ priority: 'urgent', alertLevel: 'urgent', status: 'waiting' });
    const after = await nurse.query(api.conversations.listForProfessional, { scope: 'unassigned' });
    expect(after.map((c: any) => c._id)).toEqual([convId, olderId]);
    // The nurse still sees what the patient wrote.
    const seenByNurse = await nurse.query(api.messages.list, { conversationId: convId });
    expect(seenByNurse.some((m: any) => m.content.includes('puseram alguma coisa'))).toBe(true);
    const audit = await t.run((ctx) => ctx.db.query('auditLog').collect());
    expect(audit.some((a) => a.conversationId === convId && a.action === 'escalation')).toBe(true);
  });

  it('suicidal ideation makes it an emergency', async () => {
    const { t, patient, convId } = await setup();
    await patient.mutation(api.messages.send, { conversationId: convId, content: 'Já não quero viver mais.' });
    const msgs = await messages(t, convId);
    expect(msgs[1]).toMatchObject({ messageType: 'system', content: fixed('suicide') });
    expect(await t.run((ctx) => ctx.db.get(convId))).toMatchObject({ priority: 'urgent', alertLevel: 'emergency' });
  });

  it('an ordinary message changes nothing', async () => {
    const { t, patient, convId } = await setup();
    await patient.mutation(api.messages.send, {
      conversationId: convId,
      content: 'Bebi muito na festa e não me lembro se tomei a pílula.',
    });
    expect((await messages(t, convId)).map((m) => m.messageType)).toEqual(['text']);
    const conv = await t.run((ctx) => ctx.db.get(convId));
    expect(conv?.priority).toBe('low');
    expect(conv?.alertLevel).toBeUndefined();
  });

  it("the nurse's own messages are not checked", async () => {
    const { t, nurse, nurseId, convId } = await setup();
    await t.run((ctx) => ctx.db.patch(convId, { status: 'active', professionalId: nurseId }));
    await nurse.mutation(api.messages.send, {
      conversationId: convId,
      content: 'Se sentires que o bebé deixou de mexer, liga já.',
    });
    expect((await messages(t, convId)).map((m) => m.messageType)).toEqual(['text']);
    expect((await t.run((ctx) => ctx.db.get(convId)))?.priority).toBe('low');
  });
});
