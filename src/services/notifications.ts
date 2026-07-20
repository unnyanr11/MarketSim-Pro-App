import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * requestNotificationPermissions — alias used by HomeScreen.
 * Returns true if permission is granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Register device for push notifications and upsert token in the DB.
 * Returns the push token string, or null if registration fails.
 */
export async function registerForPushNotifications(userId: number): Promise<string | null> {
  if (!Device.isDevice) return null;

  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig as any)?.projectId;

  if (!projectId) return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('housekeeping', {
      name: 'Housekeeping Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00BCD4',
      sound: 'default',
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('push_tokens')
        .upsert({ user_id: userId, push_token: token, platform: Platform.OS, updated_at: now }, { onConflict: 'user_id' }),
      supabase.from('users').update({ push_token: token }).eq('user_id', userId),
    ]);

    return token;
  } catch {
    return null;
  }
}

/**
 * Show an immediate local notification.
 * Accepts either positional args (title, body, data?) OR a single options object.
 */
export async function showInstantNotification(
  titleOrOpts: string | { title: string; body: string; data?: Record<string, unknown> },
  body?: string,
  data?: Record<string, unknown>,
): Promise<void> {
  let t: string, b: string, d: Record<string, unknown>;
  if (typeof titleOrOpts === 'object') {
    t = titleOrOpts.title;
    b = titleOrOpts.body;
    d = titleOrOpts.data ?? {};
  } else {
    t = titleOrOpts;
    b = body ?? '';
    d = data ?? {};
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: t, body: b, data: d, sound: 'default' },
    trigger: null,
  });
}
