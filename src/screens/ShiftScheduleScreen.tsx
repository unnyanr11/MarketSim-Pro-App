import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { getOrderedTasksForStaff, getShiftSummary } from '../api/tasks';
import type { OrderedTask, ShiftSummary } from '../types';

interface Props {
  navigation: { navigate: (s: string, p?: any) => void };
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'CHECKOUT', color: '#22c55e' },
  2: { label: 'VIP GUEST', color: '#a78bfa' },
  3: { label: 'EARLY CHECK-IN', color: '#f59e0b' },
  4: { label: 'STAY-OVER', color: '#0ea5e9' },
  5: { label: 'LOW', color: '#475569' },
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  IN_PROGRESS: '#0ea5e9',
  CLEANED: '#22c55e',
  DELAYED: '#ef4444',
};

export function ShiftScheduleScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<OrderedTask[]>([]);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [taskData, summaryData] = await Promise.all([
      getOrderedTasksForStaff(user.user_id),
      getShiftSummary(user.user_id),
    ]);
    setTasks(taskData);
    setSummary(summaryData);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const totalEstimated = tasks.reduce((a, t) => a + t.estimated_minutes, 0);
  const doneMinutes = tasks
    .filter(t => t.status === 'CLEANED')
    .reduce((a, t) => a + t.estimated_minutes, 0);
  const remainingMinutes = totalEstimated - doneMinutes;
  const shiftParts = user?.shift_timing?.split('-') ?? [];
  const shiftStart = shiftParts[0]?.trim() ?? 'N/A';
  const shiftEnd = shiftParts[1]?.trim() ?? 'N/A';

  const pending = tasks.filter(t => t.status !== 'CLEANED');
  const done = tasks.filter(t => t.status === 'CLEANED');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0ea5e9" />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Shift Today</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#0ea5e9" style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Shift Info Card */}
            <View style={styles.shiftCard}>
              <View style={styles.shiftRow}>
                <View style={styles.shiftItem}>
                  <Text style={styles.shiftValue}>{shiftStart}</Text>
                  <Text style={styles.shiftLabel}>Shift Start</Text>
                </View>
                <View style={styles.shiftDivider} />
                <View style={styles.shiftItem}>
                  <Text style={styles.shiftValue}>{shiftEnd}</Text>
                  <Text style={styles.shiftLabel}>Shift End</Text>
                </View>
                <View style={styles.shiftDivider} />
                <View style={styles.shiftItem}>
                  <Text style={[styles.shiftValue, { color: '#f59e0b' }]}>{tasks.length}</Text>
                  <Text style={styles.shiftLabel}>Rooms</Text>
                </View>
              </View>
            </View>

            {/* Time Estimate */}
            <View style={styles.timeCard}>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>⏱ Est. Total</Text>
                <Text style={styles.timeValue}>{totalEstimated} min</Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>✅ Completed</Text>
                <Text style={[styles.timeValue, { color: '#22c55e' }]}>{doneMinutes} min</Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>⏳ Remaining</Text>
                <Text style={[styles.timeValue, { color: '#f59e0b' }]}>{remainingMinutes} min (~{Math.ceil(remainingMinutes / 60)}h)</Text>
              </View>
            </View>

            {/* Pending Route */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 Cleaning Route ({pending.length} remaining)</Text>
                {pending.map((t, idx) => {
                  const pl = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS[5];
                  const statusColor = STATUS_COLOR[t.status] ?? '#64748b';
                  return (
                    <TouchableOpacity
                      key={t.task_id}
                      style={styles.routeCard}
                      onPress={() => navigation.navigate('TaskDetail', { task: t })}
                    >
                      <View style={styles.routeNum}>
                        <Text style={styles.routeNumText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.routeBody}>
                        <View style={styles.routeRow}>
                          <Text style={styles.routeRoom}>Room {t.room_number}</Text>
                          <View style={[styles.priorityBadge, { backgroundColor: pl.color + '22', borderColor: pl.color }]}>
                            <Text style={[styles.priorityText, { color: pl.color }]}>{pl.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.routeMeta}>{t.room_type} · Floor {t.floor_number} · {t.estimated_minutes} min</Text>
                        {t.due_time && <Text style={styles.routeDue}>⏰ Due {new Date(t.due_time).toLocaleTimeString()}</Text>}
                      </View>
                      <View style={[styles.routeStatus, { backgroundColor: statusColor }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Done Rooms */}
            {done.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Completed ({done.length})</Text>
                {done.map(t => (
                  <View key={t.task_id} style={[styles.routeCard, styles.routeCardDone]}>
                    <Text style={styles.doneRoom}>Room {t.room_number}</Text>
                    <Text style={styles.doneMeta}>{t.room_type} · {t.estimated_minutes} min</Text>
                  </View>
                ))}
              </View>
            )}

            {tasks.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🛌</Text>
                <Text style={styles.emptyTitle}>No rooms assigned</Text>
                <Text style={styles.emptyBody}>Your supervisor will assign rooms shortly.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  titleRow: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9' },
  date: { fontSize: 13, color: '#64748b', marginTop: 2 },
  shiftCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 20, marginBottom: 12 },
  shiftRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  shiftItem: { alignItems: 'center', flex: 1 },
  shiftDivider: { width: 1, height: 40, backgroundColor: '#334155' },
  shiftValue: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  shiftLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  timeCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  timeLabel: { fontSize: 14, color: '#64748b' },
  timeValue: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  routeCardDone: { opacity: 0.5 },
  routeNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  routeNumText: { fontSize: 13, fontWeight: '700', color: '#0ea5e9' },
  routeBody: { flex: 1 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  routeRoom: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  priorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  routeMeta: { fontSize: 12, color: '#64748b' },
  routeDue: { fontSize: 12, color: '#f59e0b', marginTop: 2 },
  routeStatus: { width: 8, height: 8, borderRadius: 4 },
  doneRoom: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  doneMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  emptyBody: { fontSize: 13, color: '#64748b', textAlign: 'center' },
});
