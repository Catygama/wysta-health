import { v } from 'convex/values';
import {
  mutation,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { Id } from './_generated/dataModel';

const MAX_TOKENS_PER_USER = 15;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const platform = v.union(v.literal('ios'), v.literal('android'));

export const registerPushToken = mutation({
  args: { token: v.string(), platform },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!profile) throw new Error('Profile not found');

    const now = Date.now();
    const existing = profile.pushTokens ?? [];
    const withoutDupe = existing.filter((t) => t.token !== args.token);
    const next = [
      ...withoutDupe,
      { token: args.token, platform: args.platform, addedAt: now },
    ];
    next.sort((a, b) => a.addedAt - b.addedAt);
    const trimmed = next.slice(-MAX_TOKENS_PER_USER);

    await ctx.db.patch(profile._id, { pushTokens: trimmed });
  },
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
  handler: async (ctx, args) => {
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
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const tokens: Array<{ token: string; platform: 'ios' | 'android' }> =
      await ctx.runQuery(internal.notifications.getProfileTokens, {
        userId: args.userId,
      });
    if (tokens.length === 0) return;

    const payload = tokens.map((t) => ({
      to: t.token,
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
        userId: args.userId as Id<'users'>,
        tokens: invalid,
      });
    }
  },
});
