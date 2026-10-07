export type PushPlatform = 'ios' | 'android';

export type PushRegistration = {
  token: string;
  platform: PushPlatform;
};

// Web push needs an explicit user gesture to request permission, so it is
// opt-in via components/WebPushCard.web.tsx (lib/webPush.ts) instead.
export async function registerForPushNotifications(): Promise<PushRegistration | null> {
  return null;
}

export function addTokenListener(
  _cb: (registration: PushRegistration) => void
): { remove: () => void } {
  return { remove: () => {} };
}
