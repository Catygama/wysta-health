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
  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|session` }),
    patient: t.withIdentity({ subject: `${patientId}|session` }),
  };
}

const QUESTIONS = [
  {
    id: 'weeks',
    question: 'De quantas semanas estás?',
    type: 'multiple-choice' as const,
    options: ['Menos de 24', '24 ou mais'],
    required: true,
  },
  {
    id: 'pain',
    question: 'Quanta dor sentes?',
    type: 'scale' as const,
    options: ['1', '2', '3', '4', '5'],
    alert: { level: 'urgent' as const, minScale: 4 },
    required: true,
  },
  {
    id: 'movement',
    question: 'Notaste menos movimentos?',
    type: 'yes-no' as const,
    alert: { level: 'emergency' as const },
    required: true,
    showIf: { questionId: 'weeks', equals: ['24 ou mais'] },
  },
];

describe('triage admin', () => {
  it('only admins can read or save the questions', async () => {
    const { patient } = await setup();
    await expect(patient.query(api.triage.adminGet, { topic: 'pregnancy' })).rejects.toThrow('Admin only');
    await expect(
      patient.mutation(api.triage.saveQuestions, { topic: 'pregnancy', questions: QUESTIONS })
    ).rejects.toThrow('Admin only');
  });

  it('saves the questions; new triages use them for the alert level', async () => {
    const { t, admin, patient } = await setup();
    await admin.mutation(api.triage.saveQuestions, { topic: 'pregnancy', questions: QUESTIONS });
    expect((await admin.query(api.triage.adminGet, { topic: 'pregnancy' }))?.questions).toHaveLength(3);

    const id = await patient.mutation(api.conversations.create, {
      topic: 'pregnancy',
      title: 'Gravidez',
      triageData: { responses: { weeks: '24 ou mais', pain: 4, movement: 'no' } },
    });
    const conv = await t.run((ctx) => ctx.db.get(id));
    expect(conv?.alertLevel).toBe('urgent');
  });

  it('rejects questions that would break the triage', async () => {
    const { admin } = await setup();
    const save = (questions: any[]) => admin.mutation(api.triage.saveQuestions, { topic: 'sti', questions });
    await expect(save([])).rejects.toThrow('pelo menos uma pergunta');
    await expect(save([{ ...QUESTIONS[0], question: '  ' }])).rejects.toThrow('texto da pergunta');
    await expect(save([{ ...QUESTIONS[0], options: ['Só uma'] }])).rejects.toThrow('duas opções');
    await expect(save([{ ...QUESTIONS[1], alert: { level: 'urgent', minScale: 9 } }])).rejects.toThrow('escala');
    await expect(save([QUESTIONS[2]])).rejects.toThrow('pergunta anterior');
    await expect(save([QUESTIONS[0], { ...QUESTIONS[0] }])).rejects.toThrow('repetido');
  });

  it('the seed leaves an edited triage alone', async () => {
    const { t, admin } = await setup();
    await t.mutation(internal.seed.seedTriage, {});
    await admin.mutation(api.triage.saveQuestions, { topic: 'pregnancy', questions: QUESTIONS });
    const result = await t.mutation(internal.seed.seedTriage, {});
    expect(result.kept).toBe(1);
    expect((await admin.query(api.triage.adminGet, { topic: 'pregnancy' }))?.questions).toHaveLength(3);
  });
});
