import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  addTokenListener,
  registerForPushNotifications,
} from '@/lib/pushNotifications';

export function usePushRegistration(enabled: boolean) {
  const register = useMutation(api.notifications.registerPushToken);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    registerForPushNotifications().then((reg) => {
      if (cancelled || !reg) return;
      register({ token: reg.token, platform: reg.platform }).catch((err) => {
        console.warn('[push] registerPushToken failed', err);
      });
    });

    const sub = addTokenListener((reg) => {
      register({ token: reg.token, platform: reg.platform }).catch((err) => {
        console.warn('[push] token refresh failed', err);
      });
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [enabled, register]);
}
