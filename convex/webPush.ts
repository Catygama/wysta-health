'use node';

import { v } from 'convex/values';
import { sendNotification, setVapidDetails, WebPushError } from 'web-push';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';

const TTL_SECONDS = 60 * 60 * 24;

export const send = internalAction({
  args: {
    userId: v.id('users'),
    subscriptions: v.array(
      v.object({ endpoint: v.string(), p256dh: v.string(), auth: v.string() })
    ),
    title: v.string(),
    body: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
      console.warn('[webPush] VAPID_* env vars not set; skipping web push');
      return;
    }
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      data: args.data ?? {},
    });

    const results = await Promise.allSettled(
      args.subscriptions.map((s) =>
        sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: TTL_SECONDS }
        )
      )
    );

    const expired: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') return;
      const err = r.reason;
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        expired.push(args.subscriptions[i].endpoint);
      } else {
        console.error('[webPush] send failed', err);
      }
    });

    if (expired.length > 0) {
      await ctx.runMutation(internal.notifications.removeTokensInternal, {
        userId: args.userId,
        tokens: expired,
      });
    }
  },
});
