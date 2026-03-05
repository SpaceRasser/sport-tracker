import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,  // баннер сверху
    shouldShowList: true,    // показать в центре уведомлений
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  // @ts-ignore
  return Constants?.expoConfig?.extra?.eas?.projectId;
}

export async function registerPushIfNeeded(): Promise<void> {
  console.log('[push] registerPushIfNeeded() called');
  console.log('[push] Device.isDevice =', Device.isDevice);
  console.log('[push] baseURL =', api.defaults.baseURL);

  if (!Device.isDevice) {
    console.log('[push] not a physical device -> skip');
    return;
  }

  // permissions
  const current = await Notifications.getPermissionsAsync();
  console.log('[push] perm before =', current.status);

  let status = current.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
    console.log('[push] perm after =', status);
  }

  if (status !== 'granted') {
    console.log('[push] permission not granted -> skip');
    return;
  }

  // android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    console.log('[push] android channel set');
  }

  const projectId = getProjectId();
  console.log('[push] projectId =', projectId ?? '(none)');

  let expoPushToken = '';
  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    expoPushToken = tokenRes.data;
    console.log('[push] expo token =', expoPushToken);
  } catch (e: any) {
    console.log('[push] getExpoPushTokenAsync error:', e?.message ?? e);
    throw e;
  }

  if (!expoPushToken) {
    console.log('[push] empty token -> stop');
    return;
  }

  const authHeader =
    (api.defaults.headers as any)?.common?.Authorization ??
    (api.defaults.headers as any)?.Authorization;

  if (!authHeader) {
    console.log('[push] no Authorization yet -> skip /me/device');
    return;
  }

  try {
    const resp = await api.post('/me/device', {
      token: expoPushToken,
      platform: Platform.OS,
    });
    console.log('[push] /me/device OK:', resp.data);
  } catch (e: any) {
    console.log('[push] /me/device FAILED:', e?.response?.status, e?.response?.data ?? e?.message ?? e);
    // ✅ В PROD не кидаем throw, иначе ты ловишь “рандомные” падения
    return;
  }
}