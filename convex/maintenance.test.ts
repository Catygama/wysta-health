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

describe('maintenance.usePatientWording', () => {
  it('adds a new prompt version saying "a utente"', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const createdBy = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('aiPrompts', {
        purpose: 'chat-summary',
        systemPrompt: 'Motivo: o que o utente trouxe. Sem o nome do utente. O utente já sabe quem é.',
        createdBy,
      });
    });

    const dry = await t.mutation(internal.maintenance.usePatientWording, { dryRun: true });
    expect(dry.updated).toEqual(['chat-summary/']);

    await t.mutation(internal.maintenance.usePatientWording, {});
    const prompts = await t.run((ctx) => ctx.db.query('aiPrompts').order('desc').collect());
    expect(prompts).toHaveLength(2);
    expect(prompts[0].systemPrompt).toBe(
      'Motivo: o que a utente trouxe. Sem o nome da utente. A utente já sabe quem é.'
    );

    // Running again changes nothing.
    expect((await t.mutation(internal.maintenance.usePatientWording, {})).updated).toEqual([]);
  });
});

describe('maintenance.useIaWording', () => {
  it('rewrites "AI" as "IA" in system messages, titles and prompts', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const conversationId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'contraception',
        title: 'Conversa com AI',
        priority: 'low',
        status: 'active',
        lastMessageAt: 0,
        kind: 'ai-only',
      });
      await ctx.db.insert('messages', {
        conversationId,
        senderId: userId,
        content: 'Conversa com a assistente AI.',
        messageType: 'system',
      } as any);
      await ctx.db.insert('messages', {
        conversationId,
        senderId: userId,
        content: 'Uma mensagem com AI escrita pela utente.',
        messageType: 'text',
      } as any);
      await ctx.db.insert('aiPrompts', { purpose: 'chat', systemPrompt: 'És um assistente AI.', createdBy: userId });
    });

    const res = await t.mutation(internal.maintenance.useIaWording, {});
    expect(res).toMatchObject({ messages: 1, titles: 1, prompts: ['chat/'], done: true });
    const [msgs, convs, prompts] = await t.run(async (ctx) => [
      await ctx.db.query('messages').collect(),
      await ctx.db.query('conversations').collect(),
      await ctx.db.query('aiPrompts').order('desc').collect(),
    ]);
    expect(msgs.map((m) => m.content)).toEqual([
      'Conversa com a assistente IA.',
      'Uma mensagem com AI escrita pela utente.',
    ]);
    expect(convs[0].title).toBe('Conversa com IA');
    expect(prompts[0].systemPrompt).toBe('És um assistente IA.');
  });
});
