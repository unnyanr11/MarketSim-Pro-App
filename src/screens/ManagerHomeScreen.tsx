/**
 * ManagerHomeScreen
 * Shown to users with role = MANAGER or ADMIN.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator,
  Modal, Pressable, FlatList, Alert, SafeAreaView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import type { RootStackParamList } from '../navigation/RootNavigator';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  requestNotificationPermissions,
  showInstantNotification,
} from '../services/notifications';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface HotelStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface FloorBreakdown {
  floor: number;
  total: number;
  done: number;
}

interface NotifItem {
  id: string;
  room_number: string;
  floor_number: number;
  created_at: string;
  read: boolean;
}

// ── Push token registration ───────────────────────────────────────────────────
async function registerPushToken(userId: number) {
  if (!Device.isDevice) return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await supabase.from('users').update({ push_token: token }).eq('user_id', userId);
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch (_) {}
}

// ── Floor label util ──────────────────────────────────────────────────────────
function floorLabel(f: number | null) {
  if (f === null) return 'Not Assigned';
  if (f === 0)    return 'Ground Floor';
  const last = f % 10, two = f % 100;
  let sfx = 'th';
  if (two < 11 || two > 13) {
    if (last === 1) sfx = 'st';
    else if (last === 2) sfx = 'nd';
    else if (last === 3) sfx = 'rd';
  }
  return `${f}${sfx} Floor`;
}

function timeAgo(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const m  = Math.floor(ms / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ManagerHomeScreen() {
  const navigation   = useNavigation<Nav>();
  const navigationRef = useRef<Nav>(navigation);
  useEffect(() => { navigationRef.current = navigation; }, [navigation]);

  const { user, signOut } = useAuth();
  const { role }          = usePermissions();

  const [stats,      setStats]      = useState<HotelStats | null>(null);
  const [floors,     setFloors]     = useState<FloorBreakdown[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notifVisible,  setNotifVisible]  = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const notifListener = useRef<Notifications.Subscription | null>(null);
  const respListener  = useRef<Notifications.Subscription | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: tasks } = await supabase
        .from('housekeeping_tasks')
        .select('status, due_time, rooms(floor_number)');

      if (tasks) {
        const now        = new Date();
        const total      = tasks.length;
        const pending    = tasks.filter(t => t.status === 'PENDING').length;
        const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const completed  = tasks.filter(t => t.status === 'CLEANED').length;
        const overdue    = tasks.filter(t =>
          t.status === 'PENDING' && t.due_time && new Date(t.due_time) < now,
        ).length;
        setStats({ total, pending, inProgress, completed, overdue });

        const floorMap: Record<number, { total: number; done: number }> = {};
        tasks.forEach(t => {
          const f = (t.rooms as any)?.floor_number;
          if (f == null) return;
          if (!floorMap[f]) floorMap[f] = { total: 0, done: 0 };
          floorMap[f].total++;
          if (t.status === 'CLEANED') floorMap[f].done++;
        });
        setFloors(
          Object.entries(floorMap)
            .map(([floor, v]) => ({ floor: Number(floor), ...v }))
            .sort((a, b) => a.floor - b.floor),
        );
      }
    } catch (e) {
      console.error('ManagerHome fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (!user?.user_id) return;
    (async () => {
      await requestNotificationPermissions();
      await registerPushToken(user.user_id);
    })();
  }, [fetchData, user?.user_id]);

  const onDirtyRoom = useCallback(async (room: any) => {
    const item: NotifItem = {
      id:           `${room.room_id}-${Date.now()}`,
      room_number:  room.room_number,
      floor_number: room.floor_number,
      created_at:   new Date().toISOString(),
      read:         false,
    };
    setNotifications(prev => [item, ...prev]);
    setUnreadCount(prev => prev + 1);
    await showInstantNotification({
      title: '🧹 New Task',
      body:  `Room ${room.room_number} on ${floorLabel(room.floor_number)} needs cleaning`,
      data:  { floor_number: room.floor_number, room_number: room.room_number, type: 'new_dirty_room' },
    });
    Alert.alert(
      '🧹 New Task Available',
      `Room ${room.room_number} on ${floorLabel(room.floor_number)} needs cleaning`,
      [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'View Tasks', onPress: () => navigationRef.current?.navigate('TaskList') },
      ],
    );
  }, []);

  useEffect(() => {
    if (!user?.user_id) return;
    const ch = supabase
      .channel(`manager-room-changes-${user.user_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' },
        async (payload) => {
          if (
            payload.new?.clean_status === 'DIRTY' &&
            payload.old?.clean_status !== 'DIRTY'
          ) {
            await onDirtyRoom(payload.new);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.user_id, onDirtyRoom]);

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    respListener.current  = Notifications.addNotificationResponseReceivedListener(resp => {
      const d = resp.notification.request.content.data as any;
      if (d?.type === 'new_dirty_room' || d?.type === 'overdue') {
        navigationRef.current?.navigate('TaskList');
      }
    });
    return () => {
      notifListener.current?.remove();
      respListener.current?.remove();
    };
  }, []);

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await signOut();
          navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);

  const markAllRead = () => {
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  const roleLabel2 = role === 'ADMIN' ? '🛡️ Administrator' : '📊 Manager';
  const roleColor  = role === 'ADMIN' ? '#f59e0b' : '#a78bfa';

  return (
    <SafeAreaView style={S.safe}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <View style={S.topBar}>
        <TouchableOpacity style={S.pillBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={S.pillBtnText}>👤 Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.notifBtn} onPress={() => setNotifVisible(true)}>
          <Text style={S.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={S.badge}>
              <Text style={S.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[S.pillBtn, S.redBtn]} onPress={handleLogout}>
          <Text style={S.pillBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={S.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={roleColor} />}
      >
        {/* Greeting */}
        <View style={S.header}>
          <View>
            <Text style={S.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={S.name}>{user?.full_name ?? user?.username} 👋</Text>
          </View>
          <View style={[S.roleBadge, { backgroundColor: roleColor + '22' }]}>
            <Text style={[S.roleBadgeText, { color: roleColor }]}>{roleLabel2}</Text>
          </View>
        </View>

        {/* Hotel-wide stats */}
        <Text style={S.sectionTitle}>Hotel Overview</Text>
        <View style={S.statsGrid}>
          <BigStatCard label="Total Tasks"  value={stats?.total ?? 0}      color="#64748b" />
          <BigStatCard label="Pending"      value={stats?.pending ?? 0}    color="#f59e0b" />
          <BigStatCard label="In Progress"  value={stats?.inProgress ?? 0} color="#3b82f6" />
          <BigStatCard label="Completed"    value={stats?.completed ?? 0}  color="#22c55e" />
          <BigStatCard label="⚠️ Overdue"   value={stats?.overdue ?? 0}    color="#ef4444" />
        </View>

        {/* Per-floor breakdown */}
        <Text style={S.sectionTitle}>Floor Breakdown</Text>
        {floors.map(f => {
          const pct = f.total > 0 ? f.done / f.total : 0;
          return (
            <View key={f.floor} style={S.floorCard}>
              <View style={S.floorRow}>
                <Text style={S.floorLabel}>Floor {f.floor}</Text>
                <Text style={S.floorCount}>{f.done}/{f.total} rooms</Text>
              </View>
              <View style={S.progressBar}>
                <View style={[S.progressFill, {
                  width: `${pct * 100}%` as any,
                  backgroundColor: pct === 1 ? '#22c55e' : pct > 0.5 ? '#3b82f6' : '#f59e0b',
                }]} />
              </View>
            </View>
          );
        })}

        {/* Quick actions */}
        <Text style={S.sectionTitle}>Quick Actions</Text>
        <View style={S.actionsGrid}>
          <ActionButton emoji="📋" label="All Tasks"        onPress={() => navigation.navigate('TaskList')} />
          <ActionButton emoji="👥" label="Floor View"       onPress={() => navigation.navigate('Supervisor')} />
          <ActionButton emoji="📊" label="My Performance"   onPress={() => navigation.navigate('Performance')} />
          <ActionButton emoji="🏆" label="Staff Performance" onPress={() => navigation.navigate('StaffPerformance')} />
          <ActionButton emoji="📅" label="Schedules"        onPress={() => navigation.navigate('ShiftSchedule')} />
          <ActionButton emoji="📝" label="Shift Summary"    onPress={() => navigation.navigate('ShiftSummary')} />
        </View>
      </ScrollView>

      {/* ── Notification modal ────────────────────────────────────────────── */}
      <Modal
        visible={notifVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifVisible(false)}
      >
        <Pressable style={S.overlay} onPress={() => setNotifVisible(false)}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </Text>
              <TouchableOpacity onPress={() => setNotifVisible(false)}>
                <Text style={S.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {notifications.length > 0 && (
              <View style={S.notifActions}>
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={S.notifActionText}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setNotifications([]);
                  setUnreadCount(0);
                  setNotifVisible(false);
                }}>
                  <Text style={S.notifActionText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}

            {notifications.length === 0 ? (
              <View style={S.emptyNotif}>
                <Text style={S.emptyNotifIcon}>🔔</Text>
                <Text style={S.emptyNotifTitle}>No notifications</Text>
                <Text style={S.emptyNotifSub}>
                  You'll be notified when rooms across any floor need cleaning
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[S.notifItem, !item.read && S.notifItemUnread]}
                    onPress={() => {
                      setNotifVisible(false);
                      navigation.navigate('TaskList');
                    }}
                  >
                    <Text style={S.notifEmoji}>🧹</Text>
                    <View style={S.notifContent}>
                      <Text style={S.notifTitle}>Room {item.room_number} needs cleaning</Text>
                      <Text style={S.notifSub}>
                        {floorLabel(item.floor_number)} · {timeAgo(item.created_at)}
                      </Text>
                    </View>
                    {!item.read && <View style={S.unreadDot} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function BigStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[S.statCard, { borderTopColor: color }]}>
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={S.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <Text style={S.actionEmoji}>{emoji}</Text>
      <Text style={S.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#0f172a' },
  container:       { flex: 1, backgroundColor: '#0f172a' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  pillBtn:         { backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  redBtn:          { backgroundColor: '#7f1d1d' },
  pillBtnText:     { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  notifBtn:        { position: 'relative', padding: 10 },
  bellIcon:        { fontSize: 22 },
  badge:           { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText:       { color: '#fff', fontSize: 10, fontWeight: '700' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16 },
  greeting:        { fontSize: 14, color: '#94a3b8' },
  name:            { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginTop: 2 },
  roleBadge:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  roleBadgeText:   { fontWeight: '700', fontSize: 13 },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 8 },
  statCard:        { width: '30%', flexGrow: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  statValue:       { fontSize: 28, fontWeight: '800' },
  statLabel:       { fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' },
  floorCard:       { marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  floorRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  floorLabel:      { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  floorCount:      { color: '#94a3b8', fontSize: 13 },
  progressBar:     { height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 3 },
  actionsGrid:     { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 10 },
  actionBtn:       { width: '30%', flexGrow: 1, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  actionEmoji:     { fontSize: 26 },
  actionLabel:     { color: '#cbd5e1', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', overflow: 'hidden' },
  sheetHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#334155' },
  sheetTitle:      { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  sheetClose:      { fontSize: 22, color: '#64748b', fontWeight: '700' },
  notifActions:    { flexDirection: 'row', justifyContent: 'space-around', padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  notifActionText: { color: '#0ea5e9', fontWeight: '600', fontSize: 14 },
  notifItem:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  notifItemUnread: { backgroundColor: '#0ea5e910' },
  notifEmoji:      { fontSize: 24, marginRight: 12 },
  notifContent:    { flex: 1 },
  notifTitle:      { fontSize: 14, fontWeight: '600', color: '#f1f5f9', marginBottom: 3 },
  notifSub:        { fontSize: 12, color: '#64748b' },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0ea5e9' },
  emptyNotif:      { alignItems: 'center', paddingVertical: 48 },
  emptyNotifIcon:  { fontSize: 40, marginBottom: 12 },
  emptyNotifTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  emptyNotifSub:   { fontSize: 13, color: '#64748b', textAlign: 'center', maxWidth: 260 },
});
