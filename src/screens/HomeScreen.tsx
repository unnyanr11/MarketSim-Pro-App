/**
 * HomeScreen — role-aware dashboard for HOUSEKEEPING staff.
 *
 * Uses useNavigation() hook instead of the navigation prop so it works
 * whether rendered directly by the navigator or inside a wrapper component.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Pressable, Alert, ActivityIndicator, FlatList, Platform, SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../api/client';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  requestNotificationPermissions,
  showInstantNotification,
} from '../services/notifications';
import { startOverdueAlerts, stopOverdueAlerts } from '../services/overdueAlerts';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface NotifItem {
  id: string;
  room_number: string;
  floor_number: number;
  created_at: string;
  read: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Push-token registration
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
const HomeScreen: React.FC = () => {
  // Use the hook — works regardless of how this screen is mounted
  const navigation = useNavigation<Nav>();
  const { signOut, user, isLoading: authLoading } = useAuth();

  // Keep a ref so async callbacks / realtime closures always have latest value
  const navigationRef = useRef<Nav>(navigation);
  useEffect(() => { navigationRef.current = navigation; }, [navigation]);

  const [assignedFloor,   setAssignedFloor]   = useState<number | null>(null);
  const [currentFloor,    setCurrentFloor]    = useState<number | null>(null);
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [notifVisible,    setNotifVisible]    = useState(false);
  const [notifications,   setNotifications]   = useState<NotifItem[]>([]);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const [loading,         setLoading]         = useState(true);

  const notifListener = useRef<Notifications.Subscription | null>(null);
  const respListener  = useRef<Notifications.Subscription | null>(null);

  // ── Role helpers ─────────────────────────────────────────────────────────────
  const role         = user?.role ?? 'HOUSEKEEPING';
  const isSupervisor = role === 'SUPERVISOR';
  const isManager    = role === 'MANAGER' || role === 'ADMIN';
  const isElevated   = isSupervisor || isManager;

  // ── Floor label util ──────────────────────────────────────────────────────────
  const floorLabel = (f: number | null) => {
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
  };

  // ── Data fetch ────────────────────────────────────────────────────────────────
  const fetchData = async (floor: number | null) => {
    try {
      setAssignedFloor(floor);
      setCurrentFloor(floor);
      const { data: rooms } = await supabase
        .from('rooms')
        .select('floor_number')
        .order('floor_number', { ascending: true });
      setAvailableFloors([...new Set((rooms ?? []).map((r: any) => r.floor_number as number))]);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // ── Dirty-room handler ────────────────────────────────────────────────────────
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
        {
          text: 'View Tasks',
          onPress: () => {
            navigationRef.current?.navigate('TaskList');
          },
        },
      ],
    );
  }, []);

  // ── Main effect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user?.user_id) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        await requestNotificationPermissions();
        if (!cancelled) await fetchData(user.assigned_floor ?? null);
        if (!cancelled) await registerPushToken(user.user_id);
        if (!cancelled) startOverdueAlerts(user.user_id);
      } catch (_) {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stopOverdueAlerts();
    };
  }, [authLoading, user?.user_id]);

  // ── Realtime subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.user_id) return;
    const ch = supabase
      .channel(`room-changes-${user.user_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' },
        async (payload) => {
          if (
            payload.new?.clean_status === 'DIRTY' &&
            payload.old?.clean_status !== 'DIRTY' &&
            (isElevated || assignedFloor === payload.new.floor_number)
          ) {
            await onDirtyRoom(payload.new);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.user_id, assignedFloor, onDirtyRoom]);

  // ── Push notification tap ─────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────────
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

  const timeAgo = (ts: string) => {
    const ms = Date.now() - new Date(ts).getTime();
    const m  = Math.floor(ms / 60_000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={S.loadingText}>
          {authLoading ? 'Restoring session…' : 'Loading dashboard…'}
        </Text>
      </View>
    );
  }

  const displayName = user?.full_name || user?.username || 'Staff';
  const roleLabel   = role === 'HOUSEKEEPING' ? 'Housekeeper'
                    : role === 'SUPERVISOR'   ? 'Supervisor'
                    : role === 'MANAGER'      ? 'Manager'
                    : role === 'ADMIN'        ? 'Admin'
                    : role;

  return (
    <SafeAreaView style={S.safe}>
      {/* ── Top bar ── */}
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

      <ScrollView contentContainerStyle={S.scroll}>
        {/* ── Greeting ── */}
        <View style={S.greetCard}>
          <Text style={S.greetName}>👋 {displayName}</Text>
          <View style={S.rolePill}>
            <Text style={S.roleText}>{roleLabel}</Text>
          </View>
        </View>

        {/* ── Floor selector (staff + supervisor) ── */}
        {!isManager && (
          <>
            <View style={S.section}>
              <Text style={S.sectionLabel}>📍 Assigned Floor</Text>
              <View style={S.assignedBox}>
                <Text style={S.assignedText}>{floorLabel(assignedFloor)}</Text>
              </View>
            </View>

            <View style={S.section}>
              <Text style={S.sectionLabel}>🏢 Current Floor</Text>
              <View style={S.row}>
                <View style={S.currentBox}>
                  <Text style={S.currentText}>
                    {currentFloor !== null ? floorLabel(currentFloor) : 'Select Floor'}
                  </Text>
                </View>
                <TouchableOpacity style={S.changeBtn} onPress={() => setDropdownVisible(true)}>
                  <Text style={S.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[S.primaryBtn, currentFloor === null && S.primaryBtnDisabled]}
              onPress={() => {
                if (currentFloor !== null) navigation.navigate('TaskList');
                else Alert.alert('No Floor', 'Please select a floor first.');
              }}
              disabled={currentFloor === null}
            >
              <Text style={S.primaryBtnText}>
                🧹 View Tasks — {currentFloor !== null ? floorLabel(currentFloor) : 'Select Floor'}
              </Text>
            </TouchableOpacity>

            {currentFloor !== assignedFloor && currentFloor !== null && (
              <Text style={S.warnText}>⚠️ Viewing tasks for a different floor</Text>
            )}
          </>
        )}

        {/* ── Quick links ── */}
        <Text style={S.quickTitle}>Quick Access</Text>
        <View style={S.quickGrid}>
          <QuickCard emoji="📅" label="Shift Schedule" onPress={() => navigation.navigate('ShiftSchedule')} />
          <QuickCard emoji="📊" label="Today's Summary" onPress={() => navigation.navigate('ShiftSummary')} />
          <QuickCard emoji="🏆" label="Performance"    onPress={() => navigation.navigate('Performance')} />

          {isElevated && (
            <QuickCard
              emoji="🗂️"
              label={isManager ? 'All Tasks (Manager)' : 'Supervisor Panel'}
              accent
              onPress={() => navigation.navigate('Supervisor')}
            />
          )}

          {!isManager && (
            <QuickCard emoji="✅" label="My Tasks" onPress={() => navigation.navigate('TaskList')} />
          )}
        </View>
      </ScrollView>

      {/* ── Floor picker modal ── */}
      <Modal visible={dropdownVisible} transparent animationType="slide" onRequestClose={() => setDropdownVisible(false)}>
        <Pressable style={S.overlay} onPress={() => setDropdownVisible(false)}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>Select Floor</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Text style={S.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {availableFloors.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[S.floorItem, currentFloor === f && S.floorItemActive]}
                  onPress={() => { setCurrentFloor(f); setDropdownVisible(false); }}
                >
                  <Text style={[S.floorItemText, currentFloor === f && S.floorItemTextActive]}>
                    {floorLabel(f)}
                  </Text>
                  {assignedFloor === f && <Text style={S.yourFloor}>Your Floor</Text>}
                  {currentFloor === f  && <Text style={S.check}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── Notification modal ── */}
      <Modal visible={notifVisible} transparent animationType="slide" onRequestClose={() => setNotifVisible(false)}>
        <Pressable style={S.overlay} onPress={() => setNotifVisible(false)}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>Notifications {unreadCount > 0 && `(${unreadCount})`}</Text>
              <TouchableOpacity onPress={() => setNotifVisible(false)}>
                <Text style={S.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {notifications.length > 0 && (
              <View style={S.notifActions}>
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={S.notifActionText}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setNotifications([]); setUnreadCount(0); setNotifVisible(false); }}>
                  <Text style={S.notifActionText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}
            {notifications.length === 0 ? (
              <View style={S.emptyNotif}>
                <Text style={S.emptyNotifIcon}>🔔</Text>
                <Text style={S.emptyNotifTitle}>No notifications</Text>
                <Text style={S.emptyNotifSub}>You'll be notified when new rooms need cleaning</Text>
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
                      setCurrentFloor(item.floor_number);
                      navigation.navigate('TaskList');
                    }}
                  >
                    <Text style={S.notifEmoji}>🧹</Text>
                    <View style={S.notifContent}>
                      <Text style={S.notifTitle}>Room {item.room_number} needs cleaning</Text>
                      <Text style={S.notifSub}>{floorLabel(item.floor_number)} · {timeAgo(item.created_at)}</Text>
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
};

// ── Small card component ──────────────────────────────────────────────────────
function QuickCard({ emoji, label, onPress, accent }: {
  emoji: string; label: string; onPress: () => void; accent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[S.quickCard, accent && S.quickCardAccent]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={S.quickEmoji}>{emoji}</Text>
      <Text style={[S.quickLabel, accent && S.quickLabelAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#0f172a' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText:     { marginTop: 12, fontSize: 15, color: '#64748b' },

  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  pillBtn:         { backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  redBtn:          { backgroundColor: '#7f1d1d' },
  pillBtnText:     { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  notifBtn:        { position: 'relative', padding: 10 },
  bellIcon:        { fontSize: 22 },
  badge:           { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText:       { color: '#fff', fontSize: 10, fontWeight: '700' },

  scroll:          { padding: 16, paddingBottom: 40 },

  greetCard:       { backgroundColor: '#1e293b', borderRadius: 14, padding: 18, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetName:       { fontSize: 20, fontWeight: '800', color: '#f1f5f9', flexShrink: 1 },
  rolePill:        { backgroundColor: '#0ea5e920', borderWidth: 1, borderColor: '#0ea5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 },
  roleText:        { fontSize: 12, fontWeight: '700', color: '#0ea5e9' },

  section:         { marginBottom: 16 },
  sectionLabel:    { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  assignedBox:     { backgroundColor: '#1e3a5f', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1d4ed8' },
  assignedText:    { fontSize: 17, fontWeight: '700', color: '#93c5fd', textAlign: 'center' },
  row:             { flexDirection: 'row', gap: 10 },
  currentBox:      { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  currentText:     { fontSize: 16, fontWeight: '600', color: '#f1f5f9', textAlign: 'center' },
  changeBtn:       { backgroundColor: '#0ea5e9', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, justifyContent: 'center' },
  changeBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  primaryBtn:      { backgroundColor: '#059669', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8 },
  primaryBtnDisabled: { backgroundColor: '#374151' },
  primaryBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  warnText:        { fontSize: 13, color: '#f59e0b', textAlign: 'center', marginBottom: 16 },

  quickTitle:      { fontSize: 15, fontWeight: '700', color: '#94a3b8', marginBottom: 12, marginTop: 8 },
  quickGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard:       { flexBasis: '47%', backgroundColor: '#1e293b', borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  quickCardAccent: { backgroundColor: '#1e3a5f', borderColor: '#1d4ed8' },
  quickEmoji:      { fontSize: 28, marginBottom: 8 },
  quickLabel:      { fontSize: 13, fontWeight: '600', color: '#cbd5e1', textAlign: 'center' },
  quickLabelAccent:{ color: '#93c5fd' },

  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', overflow: 'hidden' },
  sheetHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#334155' },
  sheetTitle:      { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  sheetClose:      { fontSize: 22, color: '#64748b', fontWeight: '700' },

  floorItem:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  floorItemActive: { backgroundColor: '#0ea5e920' },
  floorItemText:   { flex: 1, fontSize: 16, color: '#cbd5e1', fontWeight: '500' },
  floorItemTextActive: { color: '#0ea5e9', fontWeight: '700' },
  yourFloor:       { fontSize: 11, fontWeight: '700', color: '#22c55e', backgroundColor: '#14532d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 8 },
  check:           { fontSize: 18, color: '#0ea5e9', fontWeight: '700' },

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

export default HomeScreen;
