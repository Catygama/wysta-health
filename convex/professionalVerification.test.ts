/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const patientId = (await ctx.db.insert('users', { email: 'utente@test.pt' } as any)) as Id<'users'>;
    const adminId = (await ctx.db.insert('users', { email: 'admin@test.pt' } as any)) as Id<'users'>;
    const proId = (await ctx.db.insert('users', { email: 'enf@test.pt' } as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: patientId, role: 'patient' });
    await ctx.db.insert('userProfiles', { userId: adminId, role: 'admin' });
    const docId = await ctx.storage.store(new Blob(['cedula']));
    const convId = await ctx.db.insert('conversations', {
      patientId,
      topic: 'contraception',
      title: 'Contraceção',
      priority: 'low',
      status: 'waiting',
      lastMessageAt: 0,
      kind: 'human-async',
    });
    return { patientId, adminId, proId, docId, convId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: `${id}|s` });
  const pro = as(ids.proId);
  await pro.mutation(api.users.submitProfessionalVerification, {
    displayName: 'Enf. Ana',
    professionalLicenseNumber: '12345',
    professionalSpecialty: 'Enfermagem de Saúde Materna e Obstétrica',
    professionalVerificationDocuments: [ids.docId],
  });
  return { t, ...ids, pro, patient: as(ids.patientId), admin: as(ids.adminId) };
}

const profileOf = (t: Awaited<ReturnType<typeof setup>>['t'], userId: Id<'users'>) =>
  t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
  );

describe('professional verification', () => {
  it('a new professional sign-up is pending, not verified', async () => {
    const { t, proId } = await setup();
    const profile = await profileOf(t, proId);
    expect(profile?.role).toBe('professional');
    expect(profile?.professionalVerificationStatus).toBe('pending');
    expect(profile?.professionalVerificationRequestedAt).toBeTypeOf('number');
  });

  it('a pending professional cannot reach the queue, cases or conversations', async () => {
    const { pro, convId } = await setup();
    expect(await pro.query(api.conversations.listForProfessional, {})).toEqual([]);
    expect(await pro.query(api.conversations.queueStats, {})).toBeNull();
    expect(await pro.query(api.conversations.get, { id: convId })).toBeNull();
    expect(await pro.query(api.messages.list, { conversationId: convId })).toEqual([]);
    await expect(pro.mutation(api.conversations.assign, { id: convId })).rejects.toThrow('Unauthorized');
  });

  it('only an admin can list, approve or reject requests', async () => {
    const { patient, pro, admin, proId } = await setup();
    for (const who of [patient, pro]) {
      await expect(who.query(api.users.listPendingVerifications, {})).rejects.toThrow('Admin only');
      await expect(who.mutation(api.users.approveProfessional, { userId: proId })).rejects.toThrow('Admin only');
      await expect(who.mutation(api.users.rejectProfessional, { userId: proId })).rejects.toThrow('Admin only');
    }
    const list = await admin.query(api.users.listPendingVerifications, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: 'enf@test.pt', licenseNumber: '12345', displayName: 'Enf. Ana' });
    expect(list[0].documents).toHaveLength(1);
  });

  it('after approval the professional has access, and the review is recorded and audited', async () => {
    const { t, pro, admin, proId, adminId, convId } = await setup();
    await admin.mutation(api.users.approveProfessional, { userId: proId });

    const profile = await profileOf(t, proId);
    expect(profile?.professionalVerificationStatus).toBe('verified');
    expect(profile?.professionalVerificationReviewedBy).toBe(adminId);
    expect(profile?.professionalVerificationReviewedAt).toBeTypeOf('number');

    const queue = await pro.query(api.conversations.listForProfessional, {});
    expect(queue.map((c) => c._id)).toContain(convId);
    await pro.mutation(api.conversations.assign, { id: convId });

    const audit = await t.run((ctx) => ctx.db.query('auditLog').collect());
    expect(audit).toContainEqual(
      expect.objectContaining({ action: 'professional-approved', adminId, targetUserId: proId }),
    );
    expect(await admin.query(api.users.listPendingVerifications, {})).toEqual([]);
  });

  it('a rejection keeps access closed and stores the reason', async () => {
    const { t, pro, admin, proId, adminId } = await setup();
    await admin.mutation(api.users.rejectProfessional, { userId: proId, reason: '  Cédula não encontrada  ' });

    const profile = await profileOf(t, proId);
    expect(profile?.professionalVerificationStatus).toBe('rejected');
    expect(profile?.professionalVerificationRejectionReason).toBe('Cédula não encontrada');
    expect(await pro.query(api.conversations.listForProfessional, {})).toEqual([]);

    const audit = await t.run((ctx) => ctx.db.query('auditLog').collect());
    expect(audit).toContainEqual(
      expect.objectContaining({ action: 'professional-rejected', adminId, targetUserId: proId }),
    );
    // Already reviewed: can't be approved behind the rejection without a new request.
    await expect(admin.mutation(api.users.approveProfessional, { userId: proId })).rejects.toThrow(
      'Este pedido já foi analisado.',
    );
  });

  it('an admin promoting someone to professional also approves them', async () => {
    const { t, admin, patientId } = await setup();
    await admin.mutation(api.users.setRole, { targetUserId: patientId, role: 'professional' });
    expect((await profileOf(t, patientId))?.professionalVerificationStatus).toBe('verified');
  });

  it('a professional with no verification status is blocked', async () => {
    const { t, convId } = await setup();
    const legacyId = await t.run(async (ctx) => {
      const id = (await ctx.db.insert('users', { email: 'antiga@test.pt' } as any)) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: id, role: 'professional' });
      return id;
    });
    const legacy = t.withIdentity({ subject: `${legacyId}|s` });
    expect(await legacy.query(api.conversations.listForProfessional, {})).toEqual([]);
    expect(await legacy.query(api.conversations.get, { id: convId })).toBeNull();
    await expect(legacy.mutation(api.conversations.assign, { id: convId })).rejects.toThrow('Unauthorized');
  });

  it('the migration sends every unreviewed professional back to review, once', async () => {
    const { t, admin, adminId, patientId, proId } = await setup();
    // Reviewed by an admin: kept. Promoted via setRole: kept (reviewer recorded).
    await admin.mutation(api.users.approveProfessional, { userId: proId });
    await admin.mutation(api.users.setRole, { targetUserId: patientId, role: 'professional' });
    const { guestId, legacyId } = await t.run(async (ctx) => {
      const guestId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const legacyId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      // Guest demo sign-in: explicitly verified, but nobody reviewed it.
      await ctx.db.insert('userProfiles', {
        userId: guestId,
        role: 'professional',
        isGuest: true,
        professionalVerificationStatus: 'verified',
      });
      // Promoted before setRole recorded a status.
      await ctx.db.insert('userProfiles', { userId: legacyId, role: 'professional' });
      return { guestId, legacyId };
    });

    const first = await t.mutation(internal.users.requireReviewForUnreviewedProfessionals, {});
    expect(first.changed).toBe(2);
    expect((await profileOf(t, guestId))?.professionalVerificationStatus).toBe('pending');
    expect((await profileOf(t, legacyId))?.professionalVerificationStatus).toBe('pending');
    expect((await profileOf(t, proId))?.professionalVerificationStatus).toBe('verified');
    expect((await profileOf(t, patientId))?.professionalVerificationStatus).toBe('verified');
    expect((await profileOf(t, adminId))?.role).toBe('admin');

    const pending = await admin.query(api.users.listPendingVerifications, {});
    expect(pending.map((p) => p.userId).sort()).toEqual([guestId, legacyId].sort());
    const audit = await t.run((ctx) => ctx.db.query('auditLog').collect());
    expect(audit.filter((a) => a.action === 'professional-review-required')).toHaveLength(2);

    // Running it again changes nothing.
    const second = await t.mutation(internal.users.requireReviewForUnreviewedProfessionals, {});
    expect(second.changed).toBe(0);

    // The admin can then approve the real nurses from the usual list.
    await admin.mutation(api.users.approveProfessional, { userId: legacyId });
    expect((await profileOf(t, legacyId))?.professionalVerificationStatus).toBe('verified');
  });

  it('the guest professional sign-in is off unless ALLOW_GUEST_PROFESSIONAL is set', async () => {
    const { patient } = await setup();
    expect(await patient.query(api.users.guestProfessionalEnabled, {})).toBe(false);
  });
});
