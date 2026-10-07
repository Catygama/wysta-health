/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

type ProfileFields = Pick<
  Doc<'userProfiles'>,
  'role' | 'professionalVerificationStatus' | 'conditions' | 'medications'
>;

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = async (fields: ProfileFields) => {
      const id = (await ctx.db.insert('users', {})) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: id, ...fields });
      return id;
    };
    const patientA = await user({
      role: 'patient',
      conditions: ['Endometriose'],
      medications: ['Pílula'],
    });
    const patientB = await user({ role: 'patient' });
    const verifiedPro = await user({ role: 'professional', professionalVerificationStatus: 'verified' });
    const unverifiedPro = await user({ role: 'professional' });
    const pendingPro = await user({ role: 'professional', professionalVerificationStatus: 'pending' });
    const rejectedPro = await user({ role: 'professional', professionalVerificationStatus: 'rejected' });

    const conversationId = await ctx.db.insert('conversations', {
      patientId: patientA,
      topic: 'contraception',
      title: 'Pílula',
      priority: 'high',
      status: 'waiting',
      lastMessageAt: 0,
      kind: 'human-async',
    });
    await ctx.db.insert('messages', {
      conversationId,
      senderId: patientA,
      content: 'Esqueci-me de duas pílulas.',
      messageType: 'text',
    });
    await ctx.db.insert('messages', {
      conversationId,
      senderId: verifiedPro,
      content: 'Nota interna: confirmar data da última menstruação.',
      messageType: 'text',
      isInternal: true,
    });
    return { patientA, patientB, verifiedPro, unverifiedPro, pendingPro, rejectedPro, conversationId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: id as string });
  return { t, as, ...ids };
}

describe('patients only see their own conversations', () => {
  it("another patient can't read the conversation, its messages or find it in lists", async () => {
    const { as, patientB, conversationId } = await setup();
    const b = as(patientB);
    expect(await b.query(api.conversations.get, { id: conversationId })).toBeNull();
    expect(await b.query(api.messages.list, { conversationId })).toEqual([]);
    expect(await b.query(api.conversations.listForPatient, {})).toEqual([]);
    expect(await b.query(api.conversations.listForProfessional, {})).toEqual([]);
    expect(await b.query(api.conversations.queueStats, {})).toBeNull();
  });

  it('signed-out users get nothing', async () => {
    const { t, conversationId } = await setup();
    expect(await t.query(api.conversations.get, { id: conversationId })).toBeNull();
    expect(await t.query(api.messages.list, { conversationId })).toEqual([]);
  });

  it("a patient can't assign, close for someone else, or mark urgent", async () => {
    const { as, patientB, conversationId } = await setup();
    const b = as(patientB);
    await expect(b.mutation(api.conversations.assign, { id: conversationId })).rejects.toThrow();
    await expect(b.mutation(api.conversations.markUrgent, { id: conversationId })).rejects.toThrow();
  });
});

describe('internal notes and clinical data', () => {
  it('internal notes never reach the patient', async () => {
    const { as, patientA, verifiedPro, conversationId } = await setup();
    const patientView = await as(patientA).query(api.messages.list, { conversationId });
    expect(patientView.map((m) => m.content)).toEqual(['Esqueci-me de duas pílulas.']);
    const proView = await as(verifiedPro).query(api.messages.list, { conversationId });
    expect(proView.some((m) => m.isInternal)).toBe(true);
  });

  it("clinical profile fields are only sent to professionals", async () => {
    const { as, patientA, verifiedPro, conversationId } = await setup();
    const own = await as(patientA).query(api.conversations.get, { id: conversationId });
    expect(own?.patient?.conditions).toBeUndefined();
    expect(own?.patient?.medications).toBeUndefined();
    const pro = await as(verifiedPro).query(api.conversations.get, { id: conversationId });
    expect(pro?.patient?.conditions).toEqual(['Endometriose']);
  });
});

describe('professionals not approved', () => {
  for (const which of ['pendingPro', 'rejectedPro', 'unverifiedPro'] as const) {
    it(`${which}: no queue, no reading, no assigning`, async () => {
      const ctx = await setup();
      const pro = ctx.as(ctx[which]);
      const { conversationId } = ctx;
      expect(await pro.query(api.conversations.listForProfessional, {})).toEqual([]);
      expect(await pro.query(api.conversations.queueStats, {})).toBeNull();
      expect(await pro.query(api.conversations.get, { id: conversationId })).toBeNull();
      expect(await pro.query(api.messages.list, { conversationId })).toEqual([]);
      await expect(pro.mutation(api.conversations.assign, { id: conversationId })).rejects.toThrow();
    });
  }

  it('only a verified professional can take the request', async () => {
    const { as, verifiedPro, conversationId } = await setup();
    expect((await as(verifiedPro).query(api.conversations.listForProfessional, {})).map((c) => c._id)).toEqual([
      conversationId,
    ]);
    await as(verifiedPro).mutation(api.conversations.assign, { id: conversationId });
    const conv = await as(verifiedPro).query(api.conversations.get, { id: conversationId });
    expect(conv?.professionalId).toBe(verifiedPro);
  });
});
