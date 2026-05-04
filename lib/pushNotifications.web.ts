export type PushPlatform = 'ios' | 'android';

export type PushRegistration = {
  token: string;
  platform: PushPlatform;
};

// TODO(push-web): web push notifications not implemented yet — would need
// service worker + VAPID setup, separate from Expo's push service.
export async function registerForPushNotifications(): Promise<PushRegistration | null> {
  return null;
}

export function addTokenListener(
  _cb: (registration: PushRegistration) => void
): { remove: () => void } {
  return { remove: () => {} };
}
