/// <reference types="vite/client" />
import { vi } from 'vitest';
vi.mock('./llm', () => ({
  callLlmText: vi.fn(),
  callLlmObject: vi.fn(),
  callLlmStream: vi.fn(),
}));
import { callLlmText, callLlmObject } from './llm';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { api, internal } from '../_generated/api';
import { stripSuggestClose } from './assistant';
import type { Id } from '../_generated/dataModel';

function buildModules(): Record<string, () => Promise<unknown>> {
  const parent = import.meta.glob('../**/*.ts');
  const local = import.meta.glob('./**/*.ts');
  const result: Record<string, () => Promise<unknown>> = { ...parent };
  for (const [k, v] of Object.entries(local)) {
    result[k.replace(/^\.\//, '../ai/')] = v;
  }
  return result;
}
const modules = buildModules();

async function seedChatChain(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
    const conversationId = await ctx.db.insert('conversations', {
      patientId: userId,
      topic: 'sexual-wellbeing',
      status: 'active',
      priority: 'low',
      title: 'test',
      lastMessageAt: 0,
      kind: 'ai-only',
    } as any);
    for (const purpose of [
      'chat',
      'chat-validator-safety',
      'chat-validator-clinical',
      'chat-judge',
    ] as const) {
      await ctx.db.insert('aiConfigs', {
        purpose,
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: 'sk-test',
        createdBy: userId,
      });
      await ctx.db.insert('aiPrompts', {
        purpose,
        systemPrompt: 'x',
        userTemplate: '{{query}}',
        createdBy: userId,
      });
    }
    return { userId, conversationId };
  });
}

async function aiMessage(t: ReturnType<typeof convexTest>, conversationId: Id<'conversations'>) {
  return t.run(async (ctx) => {
    const msgs = await (ctx.db as any)
      .query('messages')
      .withIndex('by_conversation', (q: any) => q.eq('conversationId', conversationId))
      .collect();
    return (msgs as any[]).find((m: any) => m.messageType === 'ai-response') ?? null;
  });
}

describe('assistant streaming (respondAuto)', () => {
  beforeEach(() => {
    vi.mocked(callLlmText).mockReset();
    vi.mocked(callLlmObject).mockReset();
  });

  it('approved: streams draft then finalizes with the answer only', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmText).mockImplementation(async (a: any) => {
      await a.onDelta?.('Olá');
      await a.onDelta?.('Olá, aqui vai');
      return { output: 'Olá, aqui vai', inputTokens: 10, outputTokens: 5 };
    });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'send', finalAnswer: 'Olá, aqui vai' }, inputTokens: 1, outputTokens: 1 });

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).toContain('Olá, aqui vai');
    expect(msg?.content).toBe('Olá, aqui vai');
    expect(msg?.streaming).toBe(false);
  });

  it('the draft is never visible before the judge approves it', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmText).mockResolvedValue({ output: 'rascunho por validar', inputTokens: 1, outputTokens: 1 } as any);
    const seenDuringValidation: Array<{ content: string; streaming?: boolean }> = [];
    vi.mocked(callLlmObject).mockImplementation(async () => {
      const m = await aiMessage(t, conversationId);
      seenDuringValidation.push({ content: m?.content, streaming: m?.streaming });
      return seenDuringValidation.length < 3
        ? ({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 } as any)
        : ({ output: { action: 'send', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 } as any);
    });

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    expect(seenDuringValidation).toHaveLength(3);
    for (const seen of seenDuringValidation) expect(seen).toEqual({ content: '', streaming: true });
    expect((await aiMessage(t, conversationId))?.content).toBe('rascunho por validar');
  });

  it('blocked: finalizes with the fixed forwarding message', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmText).mockImplementation(async (a: any) => {
      await a.onDelta?.('rascunho perigoso');
      return { output: 'rascunho perigoso', inputTokens: 10, outputTokens: 5 };
    });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'block', reason: 'unsafe' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'block', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 });

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).toContain('Falar com enfermeiro');
    expect(msg?.content).not.toContain('rascunho perigoso');
    expect(msg?.streaming).toBe(false);
  });

  it('blocked in an AI side chat: forwards the question to the professional conversation', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await seedChatChain(t);
    const proConvId = await t.run(async (ctx) => {
      const proConvId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'sexual-wellbeing',
        status: 'waiting',
        priority: 'low',
        title: 'pro',
        lastMessageAt: 0,
        kind: 'human-async',
        counterpartConversationId: conversationId,
      });
      await ctx.db.insert('messages', {
        conversationId: proConvId,
        senderId: userId,
        content: 'Mensagem anterior para o profissional',
        messageType: 'text',
      });
      await ctx.db.patch(conversationId, {
        contextConversationId: proConvId,
        counterpartConversationId: proConvId,
      });
      return proConvId;
    });
    vi.mocked(callLlmText).mockResolvedValue({ output: 'rascunho', inputTokens: 1, outputTokens: 1 });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'block', reason: 'clinical' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'block', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 });

    // The AI sees the professional conversation as context.
    const context = await t.run((ctx) =>
      ctx.runQuery(internal.ai.assistant.gatherContext, { conversationId, userId })
    );
    expect((context as any).conversationHistory).toContain('Mensagem anterior para o profissional');
    expect((context as any).escalatesOnBlock).toBe(true);

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).toContain('Encaminhei-a');
    const [ai, pro] = await t.run(async (ctx) => [
      await ctx.db.get(conversationId),
      await ctx.db.get(proConvId),
    ]);
    // The AI chat stays an AI chat; the professional chat gets the question.
    expect(ai?.kind).toBe('ai-only');
    expect(pro).toMatchObject({ status: 'waiting', priority: 'high' });
  });

  it('error: finalizes with a fallback message', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmText).mockRejectedValue(new Error('boom'));

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'olá' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.streaming).toBe(false);
    expect(msg?.content).toContain('Não consegui responder');
  });
});

describe('assistant.gatherContext', () => {
  it('AI chat started first still reads the open professional chat on the topic', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await t.run(async (ctx) => {
      const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const proId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const conversationId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'pregnancy',
        status: 'active',
        priority: 'low',
        title: 'AI',
        lastMessageAt: 0,
        kind: 'ai-only',
      } as any);
      // Separate professional chat on the same topic, with no link to the AI chat.
      const proConvId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'pregnancy',
        status: 'active',
        priority: 'low',
        title: 'Pro',
        lastMessageAt: 0,
        kind: 'human-async',
      } as any);
      await ctx.db.insert('messages', {
        conversationId: proConvId,
        senderId: userId,
        content: 'Tenho náuseas todas as manhãs',
        messageType: 'text',
      } as any);
      await ctx.db.insert('messages', {
        conversationId: proConvId,
        senderId: proId,
        content: 'Nota só para a equipa',
        messageType: 'text',
        isInternal: true,
      } as any);
      return { userId, conversationId };
    });
    const res = (await t.run((ctx) =>
      ctx.runQuery(internal.ai.assistant.gatherContext, { conversationId, userId })
    )) as any;
    expect(res.conversationHistory).toContain('Conversa com o enfermeiro');
    expect(res.conversationHistory).toContain('Utente: Tenho náuseas todas as manhãs');
    expect(res.conversationHistory).not.toContain('Nota só para a equipa');
    expect(res.topicAndRisk).toContain('tem uma conversa com um enfermeiro em curso');
  });

  it('returns the conversation topic', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await t.run(async (ctx) => {
      const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const conversationId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'sexual-wellbeing',
        status: 'active',
        priority: 'low',
        title: 'test',
        lastMessageAt: 0,
      } as any);
      return { userId, conversationId };
    });
    const res = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.assistant.gatherContext, { conversationId, userId })
    );
    expect(res.allowed).toBe(true);
    expect((res as any).topic).toBe('sexual-wellbeing');
  });

  it('includes the wellbeing goal in topicAndRisk', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await t.run(async (ctx) => {
      const userId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      const conversationId = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'sexual-wellbeing',
        status: 'active',
        priority: 'low',
        title: 'test',
        lastMessageAt: 0,
        wellbeingGoal: 'Reacender o desejo',
      } as any);
      return { userId, conversationId };
    });
    const res = await t.run(async (ctx) =>
      ctx.runQuery(internal.ai.assistant.gatherContext, { conversationId, userId })
    );
    expect((res as any).topicAndRisk).toContain('Reacender o desejo');
  });
});

describe('suggest close marker', () => {
  it('strips the marker (and a partial one mid-stream)', () => {
    expect(stripSuggestClose('Ainda bem!\n[[SUGERIR_TERMINAR]]')).toEqual({
      text: 'Ainda bem!',
      suggestClose: true,
    });
    expect(stripSuggestClose('Ainda bem!\n[[SUGER')).toEqual({ text: 'Ainda bem!', suggestClose: false });
    expect(stripSuggestClose('Sem marcador.')).toEqual({ text: 'Sem marcador.', suggestClose: false });
  });

  it('an approved answer with the marker is flagged suggestClose, marker hidden', async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedChatChain(t);
    vi.mocked(callLlmText).mockResolvedValue({
      output: 'De nada, fico contente por ter ajudado.\n[[SUGERIR_TERMINAR]]',
      inputTokens: 1,
      outputTokens: 1,
    });
    vi.mocked(callLlmObject)
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ output: { action: 'send', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 });

    await t.action(internal.ai.assistant.respondAuto, { conversationId, query: 'obrigada, adeus' });

    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).not.toContain('SUGERIR');
    expect(msg?.metadata?.suggestClose).toBe(true);
  });
});

describe('rule-based safety detection before the model', () => {
  beforeEach(() => {
    vi.mocked(callLlmText).mockReset();
    vi.mocked(callLlmObject).mockReset();
  });

  it('answers with the fixed message, never calls the model, and escalates', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await seedChatChain(t);
    const proConvId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('conversations', {
        patientId: userId,
        topic: 'pregnancy',
        status: 'waiting',
        priority: 'low',
        title: 'pro',
        lastMessageAt: 0,
        kind: 'human-async',
      });
      await ctx.db.patch(conversationId, { counterpartConversationId: id });
      return id;
    });

    await t.action(internal.ai.assistant.respondAuto, {
      conversationId,
      query: 'Estou grávida e deixei de sentir o bebé mexer desde ontem.',
    });

    expect(vi.mocked(callLlmText)).not.toHaveBeenCalled();
    expect(vi.mocked(callLlmObject)).not.toHaveBeenCalled();
    const msg = await aiMessage(t, conversationId);
    expect(msg?.content).toContain('SNS Grávida (808 24 24 24)');
    expect(msg?.streaming).toBe(false);
    const [ai, pro, invocations, system] = await t.run(async (ctx) => [
      await ctx.db.get(conversationId),
      await ctx.db.get(proConvId),
      await ctx.db.query('aiInvocations').collect(),
      await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', proConvId))
        .collect(),
    ]);
    expect(ai).toMatchObject({ priority: 'urgent', alertLevel: 'urgent' });
    expect(pro).toMatchObject({ priority: 'urgent', alertLevel: 'urgent' });
    expect((system as any[]).some((m) => m.messageType === 'system')).toBe(true);
    expect(invocations).toEqual([]);
  });

  it('suicidal ideation is an emergency; the anonymous question also skips the model', async () => {
    const t = convexTest(schema, modules);
    const { userId, conversationId } = await seedChatChain(t);
    await t.action(internal.ai.assistant.respondAuto, {
      conversationId,
      query: 'Já não aguento mais, estou a pensar acabar com a minha vida.',
    });
    expect((await t.run((ctx) => ctx.db.get(conversationId)))?.alertLevel).toBe('emergency');
    expect((await aiMessage(t, conversationId))?.content).toContain('liga 112');

    const anon = await t
      .withIdentity({ subject: `${userId}|s` })
      .action(api.ai.assistant.respondAnonymous, { query: 'Ele obrigou-me a ter relações.' });
    expect(anon.answer).toContain('Linha de Apoio à Vítima (116 006)');
    expect(vi.mocked(callLlmText)).not.toHaveBeenCalled();
  });
});

describe('switching to the AI answers what the nurse has not answered yet', () => {
  beforeEach(() => {
    vi.mocked(callLlmText).mockReset();
    vi.mocked(callLlmObject).mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const approve = () => {
    vi.mocked(callLlmText).mockResolvedValue({ output: 'Resposta da IA', inputTokens: 1, outputTokens: 1 });
    vi.mocked(callLlmObject).mockImplementation(async (a: any) =>
      a.schema.shape.action
        ? ({ output: { action: 'send', finalAnswer: 'Resposta da IA' }, inputTokens: 1, outputTokens: 1 } as any)
        : ({ output: { decision: 'approve', reason: 'ok' }, inputTokens: 1, outputTokens: 1 } as any)
    );
  };

  // A conversation with a nurse (on another topic than seedChatChain's AI chat),
  // with the given messages in order.
  async function seedProConversation(
    t: ReturnType<typeof convexTest>,
    messages: Array<{ from: 'patient' | 'nurse'; content: string; type?: 'text' | 'system'; internal?: boolean }>
  ) {
    const { userId } = await seedChatChain(t);
    const ids = await t.run(async (ctx) => {
      const nurseId = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId, role: 'patient' });
      const proConvId = await ctx.db.insert('conversations', {
        patientId: userId,
        professionalId: nurseId,
        topic: 'contraception',
        status: 'active',
        priority: 'medium',
        title: 'pro',
        lastMessageAt: 123,
        kind: 'human-async',
      });
      for (const m of messages) {
        await ctx.db.insert('messages', {
          conversationId: proConvId,
          senderId: m.from === 'patient' ? userId : nurseId,
          content: m.content,
          messageType: m.type ?? 'text',
          isInternal: m.internal || undefined,
        });
      }
      return { nurseId, proConvId };
    });
    return { userId, ...ids, patient: t.withIdentity({ subject: `${userId}|s` }) };
  }

  async function switchAndDrain(t: ReturnType<typeof convexTest>, patient: any, id: Id<'conversations'>) {
    const res = await patient.mutation(api.conversations.switchMode, { id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return res as { id: Id<'conversations'>; created: boolean };
  }

  async function aiResponses(t: ReturnType<typeof convexTest>, conversationId: Id<'conversations'>) {
    return t.run(async (ctx) =>
      (
        (await (ctx.db as any)
          .query('messages')
          .withIndex('by_conversation', (q: any) => q.eq('conversationId', conversationId))
          .collect()) as any[]
      ).filter((m) => m.messageType === 'ai-response')
    );
  }

  it('answers the pending messages through the agent chain, without touching the nurse conversation', async () => {
    const t = convexTest(schema, modules);
    const { patient, proConvId } = await seedProConversation(t, [
      { from: 'patient', content: 'Olá' },
      { from: 'nurse', content: 'Olá, diz-me.' },
      { from: 'patient', content: 'Esqueci-me da pílula ontem.' },
      { from: 'nurse', content: 'Nota para a equipa', internal: true },
      { from: 'patient', content: 'Preciso de contraceção de emergência?' },
    ]);
    approve();
    const before = await t.run((ctx) => ctx.db.get(proConvId));

    const { id: aiId } = await switchAndDrain(t, patient, proConvId);

    const answers = await aiResponses(t, aiId);
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({ content: 'Resposta da IA', streaming: false });
    // The question is the unanswered messages, not what the nurse already answered.
    const draftPrompt = vi.mocked(callLlmText).mock.calls[0][0].userPrompt;
    expect(draftPrompt).toBe('Esqueci-me da pílula ontem.\nPreciso de contraceção de emergência?');
    const after = await t.run((ctx) => ctx.db.get(proConvId));
    for (const field of ['status', 'priority', 'lastMessageAt', 'professionalId', 'alertLevel'] as const) {
      expect(after?.[field]).toEqual(before?.[field]);
    }
  });

  it('does not answer when the nurse has already replied to everything', async () => {
    const t = convexTest(schema, modules);
    const { patient, proConvId } = await seedProConversation(t, [
      { from: 'patient', content: 'Esqueci-me da pílula ontem.' },
      { from: 'nurse', content: 'Toma-a assim que te lembrares.' },
    ]);
    approve();

    const { id: aiId } = await switchAndDrain(t, patient, proConvId);

    expect(await aiResponses(t, aiId)).toEqual([]);
    expect(vi.mocked(callLlmText)).not.toHaveBeenCalled();
  });

  it('switching back and forth answers the same question once; a new one is answered on the next switch', async () => {
    const t = convexTest(schema, modules);
    const { patient, proConvId, userId } = await seedProConversation(t, [
      { from: 'patient', content: 'Esqueci-me da pílula ontem.' },
    ]);
    approve();

    const { id: aiId } = await switchAndDrain(t, patient, proConvId);
    await switchAndDrain(t, patient, aiId);
    const again = await switchAndDrain(t, patient, proConvId);
    expect(again.id).toBe(aiId);
    expect(await aiResponses(t, aiId)).toHaveLength(1);

    await t.run((ctx) =>
      ctx.db.insert('messages', {
        conversationId: proConvId,
        senderId: userId,
        content: 'E se tiver relações hoje?',
        messageType: 'text',
      })
    );
    await switchAndDrain(t, patient, proConvId);
    expect(await aiResponses(t, aiId)).toHaveLength(2);
    const calls = vi.mocked(callLlmText).mock.calls;
    expect(calls[calls.length - 1][0].userPrompt).toBe('E se tiver relações hoje?');
  });

  it('a pending message that matches a safety rule gets the fixed message, without the model', async () => {
    const t = convexTest(schema, modules);
    const { patient, proConvId } = await seedProConversation(t, [
      { from: 'patient', content: 'Acho que puseram alguma coisa na minha bebida.' },
    ]);
    approve();

    const { id: aiId } = await switchAndDrain(t, patient, proConvId);

    const answers = await aiResponses(t, aiId);
    expect(answers).toHaveLength(1);
    expect(answers[0].content).toContain('Linha de Apoio à Vítima (116 006)');
    expect(vi.mocked(callLlmText)).not.toHaveBeenCalled();
    expect(vi.mocked(callLlmObject)).not.toHaveBeenCalled();
  });

  it('a blocked answer points to the nurse conversation without forwarding the question again', async () => {
    const t = convexTest(schema, modules);
    const { patient, proConvId } = await seedProConversation(t, [
      { from: 'patient', content: 'Posso tomar a pílula com amoxicilina?' },
    ]);
    vi.mocked(callLlmText).mockResolvedValue({ output: 'rascunho', inputTokens: 1, outputTokens: 1 });
    vi.mocked(callLlmObject).mockImplementation(async (a: any) =>
      a.schema.shape.action
        ? ({ output: { action: 'block', finalAnswer: 'x' }, inputTokens: 1, outputTokens: 1 } as any)
        : ({ output: { decision: 'block', reason: 'clinical' }, inputTokens: 1, outputTokens: 1 } as any)
    );

    const { id: aiId } = await switchAndDrain(t, patient, proConvId);

    expect((await aiResponses(t, aiId))[0].content).toBe(
      'Esta pergunta precisa de um enfermeiro. Já está na tua conversa com o enfermeiro, que te vai responder lá.'
    );
    const [pro, proMessages] = await t.run(async (ctx) => [
      await ctx.db.get(proConvId),
      await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', proConvId))
        .collect(),
    ]);
    expect(pro).toMatchObject({ priority: 'medium', status: 'active', lastMessageAt: 123 });
    expect((proMessages as any[]).some((m) => m.messageType === 'system')).toBe(false);
  });
});
