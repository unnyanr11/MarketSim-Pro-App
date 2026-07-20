import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, SafeAreaView, ActivityIndicator,
} from 'react-native';
import type { NotificationItem } from '../types';
import {
  loadNotifications, markAllNotificationsRead,
  markNotificationRead, clearNotifications,
} from '../services/notificationStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export function NotificationPanel({ visible, onClose, onUnreadCountChange }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const items = await loadNotifications();
    setNotifications(items);
    onUnreadCountChange(items.filter(n => !n.read).length);
    setLoading(false);
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (visible) loadAll();
  }, [visible, loadAll]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await loadAll();
  };

  const handleClear = async () => {
    await clearNotifications();
    setNotifications([]);
    onUnreadCountChange(0);
  };

  const handleTap = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationRead(item.id);
      await loadAll();
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      onPress={() => handleTap(item)}
      style={[styles.item, !item.read && styles.unread]}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        {!item.read && <View style={styles.dot} />}
      </View>
      <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
      <Text style={styles.itemTime}>{new Date(item.timestamp).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.actionText}>Mark all read</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear}>
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#0ea5e9" />
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubText}>You'll see room alerts and task updates here</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={n => n.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  title: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  closeBtn: { fontSize: 20, color: '#94a3b8', padding: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  actionText: { fontSize: 14, color: '#0ea5e9', fontWeight: '500' },
  item: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  unread: { backgroundColor: '#1e293b' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0ea5e9', marginLeft: 8 },
  itemBody: { fontSize: 13, color: '#94a3b8', lineHeight: 18, marginBottom: 4 },
  itemTime: { fontSize: 11, color: '#475569' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#f1f5f9', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});
