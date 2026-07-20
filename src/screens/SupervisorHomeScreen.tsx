/**
 * SupervisorHomeScreen — shown to SUPERVISOR role.
 * Uses getFloorTasks() from tasks.ts (client-side floor filter)
 * to avoid PostgREST joined-column filter bugs in supabase-js v2.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../api/client';
import { getFloorTasks } from '../api/tasks';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { HousekeepingTask } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FloorStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  delayed: number;
}

interface StaffMember {
  user_id: number;
  full_name: string;
  username: string;
  assigned_floor: number | null;
  tasksDone: number;
  tasksTotal: number;
}

export default function SupervisorHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user }   = useAuth();

  const [stats, setStats]         = useState<FloorStats | null>(null);
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const floor = user?.assigned_floor;

  const fetchData = useCallback(async () => {
    if (floor == null) {
      setLoading(false);
      return;
    }
    try {
      // ── 1. Floor task stats via shared getFloorTasks (client-side filter) ──
      const tasks: HousekeepingTask[] = await getFloorTasks(floor);
      setStats({
        total:      tasks.length,
        pending:    tasks.filter(t => t.status === 'PENDING').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed:  tasks.filter(t => t.status === 'CLEANED').length,
        delayed:    tasks.filter(t => t.status === 'DELAYED').length,
      });

      // ── 2. Staff on this floor ──────────────────────────────────────────────
      const { data: staffRows } = await supabase
        .from('users')
        .select('user_id, full_name, username, assigned_floor')
        .eq('assigned_floor', floor)
        .eq('role', 'HOUSEKEEPING')
        .eq('is_active', true);

      if (staffRows) {
        const today = new Date().toISOString().slice(0, 10);
        const enriched = await Promise.all(
          staffRows.map(async s => {
            const { data: myTasks } = await supabase
              .from('housekeeping_tasks')
              .select('status')
              .eq('assigned_to', s.user_id)
              .gte('created_at', `${today}T00:00:00.000Z`);
            const tasksTotal = myTasks?.length ?? 0;
            const tasksDone  = myTasks?.filter(t => t.status === 'CLEANED').length ?? 0;
            return { ...s, tasksTotal, tasksDone };
          })
        );
        setStaff(enriched);
      }
    } catch (e) {
      console.error('SupervisorHome fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [floor]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading floor data…</Text>
      </View>
    );
  }

  if (floor == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠️ No floor assigned to your account.</Text>
        <Text style={styles.errorSub}>Ask a manager to assign you a floor.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
          <Text style={styles.name}>{user?.full_name ?? user?.username} 👋</Text>
        </View>
        <View style={styles.floorBadge}>
          <Text style={styles.floorBadgeText}>Floor {floor}</Text>
        </View>
      </View>

      <View style={styles.rolePill}>
        <Text style={styles.rolePillText}>🔑 Floor Supervisor</Text>
      </View>

      {/* Floor stats */}
      <Text style={styles.sectionTitle}>Floor {floor} Today</Text>
      <View style={styles.statsRow}>
        <StatCard label="Total"    value={stats?.total ?? 0}      color="#64748b" />
        <StatCard label="Pending"  value={stats?.pending ?? 0}    color="#f59e0b" />
        <StatCard label="Active"   value={stats?.inProgress ?? 0} color="#3b82f6" />
        <StatCard label="Done"     value={stats?.completed ?? 0}  color="#22c55e" />
        <StatCard label="Delayed"  value={stats?.delayed ?? 0}    color="#ef4444" />
      </View>

      {/* Staff progress */}
      <Text style={styles.sectionTitle}>My Staff</Text>
      {staff.length === 0 ? (
        <Text style={styles.emptyText}>No housekeeping staff assigned to Floor {floor}.</Text>
      ) : (
        staff.map(s => (
          <View key={s.user_id} style={styles.staffCard}>
            <View style={styles.staffAvatar}>
              <Text style={styles.staffAvatarText}>
                {(s.full_name ?? s.username)[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffName}>{s.full_name}</Text>
              <Text style={styles.staffSub}>@{s.username}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${s.tasksTotal > 0 ? (s.tasksDone / s.tasksTotal) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.staffCount}>{s.tasksDone}/{s.tasksTotal}</Text>
          </View>
        ))
      )}

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <ActionButton emoji="📋" label="Floor Tasks"  onPress={() => navigation.navigate('Supervisor')} />
        <ActionButton emoji="📅" label="Shift"        onPress={() => navigation.navigate('ShiftSchedule')} />
        <ActionButton emoji="📊" label="Performance" onPress={() => navigation.navigate('Performance')} />
        <ActionButton emoji="👤" label="Profile"      onPress={() => navigation.navigate('Profile')} />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f172a' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', gap: 8 },
  loadingText:     { color: '#64748b', fontSize: 14, marginTop: 8 },
  errorText:       { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  errorSub:        { color: '#64748b', fontSize: 13 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56 },
  greeting:        { fontSize: 14, color: '#94a3b8' },
  name:            { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginTop: 2 },
  floorBadge:      { backgroundColor: '#1e3a5f', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  floorBadgeText:  { color: '#60a5fa', fontWeight: '600', fontSize: 13 },
  rolePill:        { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#1e293b', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, alignSelf: 'flex-start' },
  rolePillText:    { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  statsRow:        { flexDirection: 'row', marginHorizontal: 12, gap: 6, flexWrap: 'wrap' },
  statCard:        { flex: 1, minWidth: 60, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  statValue:       { fontSize: 22, fontWeight: '800' },
  statLabel:       { fontSize: 10, color: '#64748b', marginTop: 2 },
  staffCard:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, gap: 12 },
  staffAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  staffAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  staffName:       { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  staffSub:        { color: '#64748b', fontSize: 12, marginTop: 1 },
  progressBar:     { height: 4, backgroundColor: '#334155', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: '#22c55e', borderRadius: 2 },
  staffCount:      { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  emptyText:       { color: '#475569', fontSize: 14, marginHorizontal: 20, fontStyle: 'italic' },
  actionsGrid:     { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 10 },
  actionBtn:       { width: '46%', backgroundColor: '#1e293b', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  actionEmoji:     { fontSize: 28 },
  actionLabel:     { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
});
