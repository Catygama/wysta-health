/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const { adminId, patientId } = await t.run(async (ctx) => {
    const adminId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const patientId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: adminId, role: 'admin' });
    await ctx.db.insert('userProfiles', { userId: patientId, role: 'patient' });
    return { adminId, patientId };
  });
  const admin = t.withIdentity({ subject: `${adminId}|session` });
  const patient = t.withIdentity({ subject: `${patientId}|session` });
  return { t, admin, patient };
}

const ARTICLE = {
  title: 'Endometriose',
  topic: 'menstrual-cycle' as const,
  summary: 'O que saber.',
  content: 'Texto do artigo.',
};

describe('education admin', () => {
  it('only admins can list, save or publish', async () => {
    const { patient } = await setup();
    await expect(patient.query(api.education.adminList, {})).rejects.toThrow('Admin only');
    await expect(patient.mutation(api.education.save, { ...ARTICLE, publish: true })).rejects.toThrow(
      'Admin only'
    );
  });

  it('a draft stays out of Explorar until it is published', async () => {
    const { admin, patient } = await setup();
    const id = await admin.mutation(api.education.save, { ...ARTICLE, publish: false });

    expect(await patient.query(api.education.listByTopic, {})).toHaveLength(0);
    expect(await patient.query(api.education.get, { id })).toBeNull();
    expect(await admin.query(api.education.get, { id })).toMatchObject({ title: 'Endometriose' });
    expect(await admin.query(api.education.adminList, {})).toMatchObject([{ _id: id, isPublished: false }]);

    await admin.mutation(api.education.setPublished, { id, isPublished: true });
    expect(await patient.query(api.education.listByTopic, {})).toMatchObject([{ _id: id }]);
  });

  it('publishing needs a summary and text; a draft only a title', async () => {
    const { admin } = await setup();
    await expect(
      admin.mutation(api.education.save, { ...ARTICLE, content: '  ', publish: true })
    ).rejects.toThrow('Para publicar');
    await expect(admin.mutation(api.education.save, { ...ARTICLE, title: ' ', publish: false })).rejects.toThrow(
      'título'
    );
    const id = await admin.mutation(api.education.save, { ...ARTICLE, content: '', publish: false });
    expect(id).toBeTruthy();
  });

  it('computes the reading time and logs the action', async () => {
    const { t, admin } = await setup();
    const content = Array.from({ length: 600 }, () => 'palavra').join(' ');
    const id = await admin.mutation(api.education.save, { ...ARTICLE, content, publish: true });
    const [article, audit] = await t.run(async (ctx) => [
      await ctx.db.get(id),
      await ctx.db.query('auditLog').collect(),
    ]);
    expect(article?.readingTimeMinutes).toBe(3);
    expect(audit.map((a) => a.action)).toEqual(['article-published']);
  });

  it('re-running the seed keeps articles an admin edited, even renamed', async () => {
    const { t, admin } = await setup();
    await t.mutation(internal.seed.seedArticles, {});
    const [first] = await admin.query(api.education.adminList, {});
    const original = await admin.query(api.education.get, { id: first._id });

    await admin.mutation(api.education.save, {
      id: first._id,
      title: 'Título novo',
      topic: original!.topic,
      summary: 'Resumo editado',
      content: original!.content,
      publish: true,
    });
    const before = (await admin.query(api.education.adminList, {})).length;

    const result = await t.mutation(internal.seed.seedArticles, {});
    expect(result.kept).toBe(1);
    expect(await admin.query(api.education.adminList, {})).toHaveLength(before);
    expect(await admin.query(api.education.get, { id: first._id })).toMatchObject({
      title: 'Título novo',
      summary: 'Resumo editado',
    });
  });
});
