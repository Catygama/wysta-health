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
    const adminId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const patientId = (await ctx.db.insert('users', { email: 'p@test.pt' } as any)) as Id<'users'>;
    const proId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: adminId, role: 'admin' });
    await ctx.db.insert('userProfiles', { userId: patientId, role: 'patient' });
    await ctx.db.insert('userProfiles', {
      userId: proId,
      role: 'professional',
      professionalVerificationStatus: 'verified',
    });
    const convId = await ctx.db.insert('conversations', {
      patientId,
      professionalId: proId,
      topic: 'contraception',
      title: 'Contraceção',
      priority: 'low',
      status: 'active',
      lastMessageAt: 0,
      kind: 'human-async',
    });
    await ctx.db.insert('messages', {
      conversationId: convId,
      senderId: proId,
      content: 'Olá, sou a enfermeira.',
      messageType: 'text',
    } as any);
    // A signed-in session for the patient.
    await ctx.db.insert('authSessions', { userId: patientId, expirationTime: Date.now() + 1e9 } as any);
    return { adminId, patientId, proId, convId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: `${id}|s` });
  return { t, ...ids, as, admin: as(ids.adminId) };
}

describe('admin: block access', () => {
  it('a blocked user is signed out and treated as signed out until unblocked', async () => {
    const { t, admin, as, patientId } = await setup();
    const patient = as(patientId);
    expect(await patient.query(api.conversations.listForPatient, {})).toHaveLength(1);

    await admin.mutation(api.users.blockUser, { userId: patientId, reason: 'Abuso' });
    const sessions = await t.run((ctx) =>
      ctx.db.query('authSessions').withIndex('userId', (q) => q.eq('userId', patientId)).collect()
    );
    expect(sessions).toHaveLength(0);
    expect(await patient.query(api.conversations.listForPatient, {})).toHaveLength(0);
    // The app can still tell the account is blocked.
    expect((await patient.query(api.users.currentUser, {}))?.profile?.blockedAt).toBeTruthy();

    await admin.mutation(api.users.unblockUser, { userId: patientId });
    expect(await patient.query(api.conversations.listForPatient, {})).toHaveLength(1);
  });

  it('only admins, and never on their own account', async () => {
    const { admin, as, adminId, patientId, proId } = await setup();
    await expect(as(patientId).mutation(api.users.blockUser, { userId: proId })).rejects.toThrow();
    await expect(admin.mutation(api.users.blockUser, { userId: adminId })).rejects.toThrow('própria conta');
    await expect(
      admin.mutation(api.users.deleteUser, { userId: adminId, confirmation: 'APAGAR' })
    ).rejects.toThrow('própria conta');
  });
});

describe('admin: delete account', () => {
  it("deleting a patient erases their conversations and sign-in", async () => {
    const { t, admin, patientId, convId } = await setup();
    await admin.mutation(api.users.deleteUser, { userId: patientId, confirmation: 'APAGAR' });
    const [user, conv, profile, audit] = await t.run(async (ctx) => [
      await ctx.db.get(patientId),
      await ctx.db.get(convId),
      await ctx.db.query('userProfiles').withIndex('by_user', (q) => q.eq('userId', patientId)).unique(),
      await ctx.db.query('auditLog').collect(),
    ]);
    expect(user).toBeNull();
    expect(conv).toBeNull();
    expect(profile).toBeNull();
    expect(audit.map((a) => a.action)).toContain('account-deleted');
  });

  it("deleting a professional sends their open conversations back to the queue", async () => {
    const { t, admin, proId, convId } = await setup();
    await admin.mutation(api.users.deleteUser, { userId: proId, confirmation: 'APAGAR' });
    const [user, conv, messages] = await t.run(async (ctx) => [
      await ctx.db.get(proId),
      await ctx.db.get(convId),
      await ctx.db.query('messages').withIndex('by_conversation', (q) => q.eq('conversationId', convId)).collect(),
    ]);
    expect(user).toBeNull();
    expect(conv?.status).toBe('waiting');
    expect(conv?.professionalId).toBeUndefined();
    // What they wrote stays in the patient's conversation.
    expect(messages).toHaveLength(1);
  });
});
