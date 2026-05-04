import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPlatform = 'ios' | 'android';

export type PushRegistration = {
  token: string;
  platform: PushPlatform;
};

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

export async function registerForPushNotifications(): Promise<PushRegistration | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn(
      '[push] missing EAS projectId — add expo.extra.eas.projectId to app.json'
    );
    return null;
  }

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: result.data, platform: Platform.OS };
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed', err);
    return null;
  }
}

export function addTokenListener(
  cb: (registration: PushRegistration) => void
): { remove: () => void } {
  const sub = Notifications.addPushTokenListener((tokenData) => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    cb({ token: tokenData.data, platform: Platform.OS });
  });
  return sub;
}
