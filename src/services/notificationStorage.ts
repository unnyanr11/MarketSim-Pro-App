import AsyncStorage from '@react-native-async-storage/async-storage';
import { error as logError } from '../lib/logger';
import type { NotificationItem } from '../types';

const STORAGE_KEY = '@hms_notifications';
const MAX_NOTIFICATIONS = 50;

export async function loadNotifications(): Promise<NotificationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch (err) {
    logError('loadNotifications', err);
    return [];
  }
}

export async function addNotification(notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): Promise<NotificationItem> {
  const newItem: NotificationItem = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    read: false,
  };

  try {
    const existing = await loadNotifications();
    const updated = [newItem, ...existing].slice(0, MAX_NOTIFICATIONS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    logError('addNotification', err);
  }

  return newItem;
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    const existing = await loadNotifications();
    const updated = existing.map(n => (n.id === id ? { ...n, read: true } : n));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    logError('markNotificationRead', err);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const existing = await loadNotifications();
    const updated = existing.map(n => ({ ...n, read: true }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    logError('markAllNotificationsRead', err);
  }
}

export async function clearNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    logError('clearNotifications', err);
  }
}
