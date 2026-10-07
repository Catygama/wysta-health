/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

async function patient(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    const id = (await ctx.db.insert('users', {})) as Id<'users'>;
    await ctx.db.insert('userProfiles', { userId: id, role: 'patient' });
    return id;
  });
  return { as: t.withIdentity({ subject: userId as string }), userId };
}

async function tokensOf(t: ReturnType<typeof convexTest>, userId: Id<'users'>) {
  return t.query(internal.notifications.getProfileTokens, { userId });
}

describe('web push subscriptions', () => {
  it('stores the endpoint and keys as a web entry', async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await patient(t);
    await as.mutation(api.notifications.registerWebPushSubscription, SUB);
    const tokens = await tokensOf(t, userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      token: SUB.endpoint,
      platform: 'web',
      webKeys: SUB.keys,
    });
  });

  it('dedupes re-registration of the same endpoint', async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await patient(t);
    await as.mutation(api.notifications.registerWebPushSubscription, SUB);
    await as.mutation(api.notifications.registerWebPushSubscription, SUB);
    expect(await tokensOf(t, userId)).toHaveLength(1);
  });

  it('rejects non-https endpoints', async () => {
    const t = convexTest(schema, modules);
    const { as } = await patient(t);
    await expect(
      as.mutation(api.notifications.registerWebPushSubscription, {
        ...SUB,
        endpoint: 'http://evil.example/push',
      })
    ).rejects.toThrow('Invalid push endpoint');
  });

  it('keeps native and web entries side by side', async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await patient(t);
    await as.mutation(api.notifications.registerPushToken, {
      token: 'ExponentPushToken[x]',
      platform: 'android',
    });
    await as.mutation(api.notifications.registerWebPushSubscription, SUB);
    const platforms = (await tokensOf(t, userId)).map((e) => e.platform);
    expect(platforms.toSorted()).toEqual(['android', 'web']);
  });

  it('sendToUser schedules the web push action for web entries', async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await patient(t);
    await as.mutation(api.notifications.registerWebPushSubscription, SUB);
    await t.action(internal.notifications.sendToUser, {
      userId,
      title: 'Profissional Wysta',
      body: 'Nova resposta',
    });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].name).toContain('webPush');
    expect(scheduled[0].args[0]).toMatchObject({
      userId,
      subscriptions: [{ endpoint: SUB.endpoint, ...SUB.keys }],
    });
  });
});

describe('message notifications', () => {
  it('only reveal the sender, never the message content', async () => {
    const t = convexTest(schema, modules);
    const { userId: patientId } = await patient(t);
    const { proId, conversationId } = await t.run(async (ctx) => {
      const proId = (await ctx.db.insert('users', {})) as Id<'users'>;
      await ctx.db.insert('userProfiles', {
        userId: proId,
        role: 'professional',
        professionalVerificationStatus: 'verified',
        displayName: 'Ana Gomes',
      });
      const conversationId = await ctx.db.insert('conversations', {
        patientId,
        professionalId: proId,
        topic: 'contraception',
        priority: 'high',
        status: 'waiting',
        title: 'Pílula',
        lastMessageAt: Date.now(),
      });
      return { proId, conversationId };
    });
    await t
      .withIdentity({ subject: proId as string })
      .mutation(api.messages.send, { conversationId, content: 'Resultado do teste: positivo' });

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    );
    const push = scheduled.find((s) => s.name.includes('sendToUser'));
    expect(push?.args[0]).toMatchObject({
      userId: patientId,
      title: 'Nova mensagem de Ana Gomes',
      data: { conversationId },
    });
    expect(JSON.stringify(push?.args)).not.toContain('positivo');
  });
});
