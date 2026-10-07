/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

type Role = 'patient' | 'professional' | 'admin';

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = async (role: Role) => {
      const id = (await ctx.db.insert('users', {})) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: id, role });
      return id;
    };
    const patientId = await user('patient');
    const otherPatientId = await user('patient');
    const proId = await user('professional');
    const otherProId = await user('professional');
    const adminId = await user('admin');
    const conversationId = await ctx.db.insert('conversations', {
      patientId,
      professionalId: proId,
      topic: 'contraception',
      priority: 'high',
      status: 'active',
      title: 'Pílula',
      lastMessageAt: 0,
      kind: 'human-async',
    });
    return { patientId, otherPatientId, proId, otherProId, adminId, conversationId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: id as string });
  const messages = () =>
    t.run((ctx) =>
      ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', ids.conversationId))
        .collect()
    );
  return { t, as, messages, ...ids };
}

describe('messages.send access', () => {
  it('lets the patient and the assigned professional write', async () => {
    const { as, messages, patientId, proId, conversationId } = await setup();
    await as(patientId).mutation(api.messages.send, { conversationId, content: 'Olá' });
    await as(proId).mutation(api.messages.send, { conversationId, content: 'Bom dia' });
    await as(proId).mutation(api.messages.send, {
      conversationId,
      content: 'Nota',
      isInternal: true,
    });
    expect(await messages()).toHaveLength(3);
  });

  it('rejects anyone else, including other professionals and admins', async () => {
    const { as, messages, otherPatientId, otherProId, adminId, conversationId } =
      await setup();
    for (const id of [otherPatientId, otherProId, adminId]) {
      await expect(
        as(id).mutation(api.messages.send, { conversationId, content: 'x' })
      ).rejects.toThrow();
    }
    expect(await messages()).toHaveLength(0);
  });

  it('does not let the patient write internal notes', async () => {
    const { as, messages, patientId, conversationId } = await setup();
    await expect(
      as(patientId).mutation(api.messages.send, {
        conversationId,
        content: 'x',
        isInternal: true,
      })
    ).rejects.toThrow();
    expect(await messages()).toHaveLength(0);
  });

  it('does not accept server-only message types from clients', async () => {
    const { as, messages, patientId, conversationId } = await setup();
    for (const messageType of ['system', 'triage-response']) {
      await expect(
        as(patientId).mutation(api.messages.send, {
          conversationId,
          content: 'x',
          // @ts-expect-error server-only message types are not accepted
          messageType,
        })
      ).rejects.toThrow();
    }
    expect(await messages()).toHaveLength(0);
  });
});
