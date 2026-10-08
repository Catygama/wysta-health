/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// A brand-new account (signed in, no profile yet) and the convId it probes.
async function setup({ withAdmin = true } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const newId = (await ctx.db.insert('users', { email: 'nova@test.pt' } as any)) as Id<'users'>;
    const patientId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: patientId, role: 'patient' });
    let adminId: Id<'users'> | null = null;
    if (withAdmin) {
      adminId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: adminId, role: 'admin' });
    }
    const convId = await ctx.db.insert('conversations', {
      patientId,
      topic: 'contraception',
      title: 'Contraceção',
      priority: 'low',
      status: 'waiting',
      lastMessageAt: 0,
      kind: 'human-async',
    });
    return { newId, patientId, adminId, convId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: `${id}|s` });
  return { t, ...ids, as, newcomer: as(ids.newId) };
}

const profileOf = (t: Awaited<ReturnType<typeof setup>>['t'], userId: Id<'users'>) =>
  t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
  );

describe('a new account cannot give itself professional or admin access', () => {
  it('ensureProfile always creates a patient and rejects a role from the client', async () => {
    const { t, newcomer, newId } = await setup();
    for (const role of ['professional', 'admin']) {
      await expect(newcomer.mutation(api.users.ensureProfile, { role } as any)).rejects.toThrow();
    }
    await newcomer.mutation(api.users.ensureProfile, {});
    const profile = await profileOf(t, newId);
    expect(profile?.role).toBe('patient');
    expect(profile?.professionalVerificationStatus).toBeUndefined();
  });

  it('the professional sign-up stays pending and grants no access', async () => {
    const { t, newcomer, newId, convId } = await setup();
    const docId = await t.run((ctx) => ctx.storage.store(new Blob(['cedula'])));
    await newcomer.mutation(api.users.submitProfessionalVerification, {
      professionalLicenseNumber: '999',
      professionalSpecialty: 'Enfermagem',
      professionalVerificationDocuments: [docId],
    });
    expect((await profileOf(t, newId))?.professionalVerificationStatus).toBe('pending');
    expect(await newcomer.query(api.conversations.listForProfessional, {})).toEqual([]);
    expect(await newcomer.query(api.conversations.get, { id: convId })).toBeNull();
    // ...and it can't approve itself.
    await expect(newcomer.mutation(api.users.approveProfessional, { userId: newId })).rejects.toThrow('Só a administração pode fazer isto.');
  });

  it('setRole needs an admin, so a new account cannot promote itself', async () => {
    const { t, newcomer, newId } = await setup();
    await newcomer.mutation(api.users.ensureProfile, {});
    for (const role of ['professional', 'admin'] as const) {
      await expect(newcomer.mutation(api.users.setRole, { targetUserId: newId, role })).rejects.toThrow(
        'Só a administração pode fazer isto.',
      );
    }
    expect((await profileOf(t, newId))?.role).toBe('patient');
  });

  it('bootstrapAdmin is refused once any admin exists', async () => {
    const { t, newcomer, newId } = await setup();
    await newcomer.mutation(api.users.ensureProfile, {});
    await expect(newcomer.mutation(api.users.bootstrapAdmin, {})).rejects.toThrow('Já existe um administrador.');
    expect((await profileOf(t, newId))?.role).toBe('patient');
  });

  it('bootstrapAdmin works only for the very first admin', async () => {
    const { t, as, newcomer, newId, patientId } = await setup({ withAdmin: false });
    await newcomer.mutation(api.users.bootstrapAdmin, {});
    expect((await profileOf(t, newId))?.role).toBe('admin');
    await expect(as(patientId).mutation(api.users.bootstrapAdmin, {})).rejects.toThrow('Já existe um administrador.');
  });

  it('the last admin cannot be removed, which would reopen bootstrapAdmin', async () => {
    const { t, as, adminId, patientId } = await setup();
    const admin = as(adminId!);
    await expect(admin.mutation(api.users.setRole, { targetUserId: adminId!, role: 'patient' })).rejects.toThrow(
      'Não é possível remover o último administrador.',
    );
    // With a second admin, demoting one is fine.
    await admin.mutation(api.users.setRole, { targetUserId: patientId, role: 'admin' });
    await admin.mutation(api.users.setRole, { targetUserId: adminId!, role: 'patient' });
    expect((await profileOf(t, adminId!))?.role).toBe('patient');
  });

  it('an admin cannot turn itself into a pending professional', async () => {
    const { t, as, adminId } = await setup();
    const docId = await t.run((ctx) => ctx.storage.store(new Blob(['x'])));
    await expect(
      as(adminId!).mutation(api.users.submitProfessionalVerification, {
        professionalLicenseNumber: '1',
        professionalSpecialty: 'x',
        professionalVerificationDocuments: [docId],
      }),
    ).rejects.toThrow('administrador');
    expect((await profileOf(t, adminId!))?.role).toBe('admin');
  });
});
