export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toSubscription(sub: PushSubscription): WebPushSubscription | null {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

// Must be called from a user gesture: Safari and Firefox reject
// Notification.requestPermission() otherwise.
export async function subscribeToWebPush(
  vapidPublicKey: string
): Promise<WebPushSubscription | null> {
  if (!isWebPushSupported()) return null;
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey),
    }));
  return toSubscription(sub);
}
