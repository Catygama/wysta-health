import { v } from 'convex/values';
import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc } from './_generated/dataModel';

const MAX_TOKENS_PER_USER = 15;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const nativePlatform = v.union(v.literal('ios'), v.literal('android'));

type PushEntry = NonNullable<Doc<'userProfiles'>['pushTokens']>[number];

async function upsertPushEntry(
  ctx: MutationCtx,
  entry: Omit<PushEntry, 'addedAt'>
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Not authenticated');
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (!profile) throw new Error('Profile not found');

  const existing = profile.pushTokens ?? [];
  const withoutDupe = existing.filter((t) => t.token !== entry.token);
  const next = [...withoutDupe, { ...entry, addedAt: Date.now() }];
  next.sort((a, b) => a.addedAt - b.addedAt);
  const trimmed = next.slice(-MAX_TOKENS_PER_USER);

  await ctx.db.patch(profile._id, { pushTokens: trimmed });
}

export const registerPushToken = mutation({
  args: { token: v.string(), platform: nativePlatform },
  handler: async (ctx, args) => {
    await upsertPushEntry(ctx, { token: args.token, platform: args.platform });
  },
});

export const registerWebPushSubscription = mutation({
  args: {
    endpoint: v.string(),
    keys: v.object({ p256dh: v.string(), auth: v.string() }),
  },
  handler: async (ctx, args) => {
    if (!args.endpoint.startsWith('https://')) {
      throw new Error('Invalid push endpoint');
    }
    await upsertPushEntry(ctx, {
      token: args.endpoint,
      platform: 'web',
      webKeys: args.keys,
    });
  },
});

export const webPushPublicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

export const removePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!profile?.pushTokens) return;
    await ctx.db.patch(profile._id, {
      pushTokens: profile.pushTokens.filter((t) => t.token !== args.token),
    });
  },
});

export const getProfileTokens = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, args): Promise<PushEntry[]> => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    return profile?.pushTokens ?? [];
  },
});

export const removeTokensInternal = internalMutation({
  args: { userId: v.id('users'), tokens: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.tokens.length === 0) return;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    if (!profile?.pushTokens) return;
    const drop = new Set(args.tokens);
    await ctx.db.patch(profile._id, {
      pushTokens: profile.pushTokens.filter((t) => !drop.has(t.token)),
    });
  },
});

type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

export const sendToUser = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const tokens: PushEntry[] = await ctx.runQuery(
      internal.notifications.getProfileTokens,
      { userId: args.userId }
    );

    const native: string[] = [];
    const web: Array<{ endpoint: string; p256dh: string; auth: string }> = [];
    for (const t of tokens) {
      if (t.platform === 'web') {
        if (t.webKeys) web.push({ endpoint: t.token, ...t.webKeys });
      } else {
        native.push(t.token);
      }
    }

    if (web.length > 0) {
      await ctx.scheduler.runAfter(0, internal.webPush.send, {
        userId: args.userId,
        subscriptions: web,
        title: args.title,
        body: args.body,
        data: args.data,
      });
    }

    if (native.length === 0) return;

    const payload = native.map((token) => ({
      to: token,
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      sound: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('Expo push failed', res.status, await res.text());
      return;
    }

    const json = (await res.json()) as { data?: PushTicket[] };
    const tickets = json.data ?? [];
    const invalid: string[] = [];
    tickets.forEach((ticket, i) => {
      if (
        ticket.status === 'error' &&
        (ticket.details?.error === 'DeviceNotRegistered' ||
          ticket.details?.error === 'InvalidCredentials')
      ) {
        invalid.push(payload[i].to);
      }
    });

    if (invalid.length > 0) {
      await ctx.runMutation(internal.notifications.removeTokensInternal, {
        userId: args.userId,
        tokens: invalid,
      });
    }
  },
});
