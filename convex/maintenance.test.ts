/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

describe('maintenance.useNurseWording', () => {
  it('adds a new prompt version saying "enfermeiro", keeping adjectives', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const createdBy = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('aiPrompts', {
        purpose: 'chat',
        systemPrompt:
          'Tom acolhedor mas profissional. Recomenda falar com um profissional de saúde.\n' +
          'Vê a linha "Profissional:". Nada de medicamento sem indicação de um profissional.',
        createdBy,
      });
    });

    const dry = await t.mutation(internal.maintenance.useNurseWording, { dryRun: true });
    expect(dry.updated).toEqual(['chat/']);

    await t.mutation(internal.maintenance.useNurseWording, {});
    const prompts = await t.run((ctx) => ctx.db.query('aiPrompts').order('desc').collect());
    expect(prompts).toHaveLength(2);
    expect(prompts[0].systemPrompt).toBe(
      'Tom acolhedor mas profissional. Recomenda falar com um enfermeiro.\n' +
        'Vê a linha "Enfermeiro:". Nada de medicamento sem indicação médica.'
    );

    // Running again changes nothing.
    expect((await t.mutation(internal.maintenance.useNurseWording, {})).updated).toEqual([]);
  });
});
