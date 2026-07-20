import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, SafeAreaView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { getShiftSummary } from '../api/tasks';
import type { ShiftSummary } from '../types';

export function ShiftSummaryScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const data = await getShiftSummary(user.user_id);
    setSummary(data);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const completionRate = summary && summary.total_assigned > 0
    ? Math.round((Number(summary.completed) / Number(summary.total_assigned)) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0ea5e9" />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Today's Shift</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#0ea5e9" style={{ marginTop: 60 }} />
        ) : !summary ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No tasks assigned today</Text>
          </View>
        ) : (
          <>
            {/* Completion Arc */}
            <View style={styles.completionCard}>
              <Text style={styles.completionRate}>{completionRate}%</Text>
              <Text style={styles.completionLabel}>Completed</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${completionRate}%` as any }]} />
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.grid}>
              <StatCard label="Total Assigned" value={String(summary.total_assigned)} color="#0ea5e9" />
              <StatCard label="Cleaned" value={String(summary.completed)} color="#22c55e" />
              <StatCard label="In Progress" value={String(summary.in_progress)} color="#f59e0b" />
              <StatCard label="Pending" value={String(summary.pending)} color="#64748b" />
              <StatCard label="Delayed" value={String(summary.delayed)} color="#ef4444" />
              <StatCard label="DND / Skipped" value={String(summary.dnd_count)} color="#a78bfa" />
            </View>

            {/* Time Stats */}
            <View style={styles.timeCard}>
              <Text style={styles.cardTitle}>⏱ Time Performance</Text>
              <TimeRow label="Avg cleaning time" value={summary.avg_minutes ? `${summary.avg_minutes.toFixed(1)} min` : 'N/A'} />
              <TimeRow label="Total time cleaning" value={summary.total_minutes ? `${summary.total_minutes} min` : 'N/A'} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  titleRow: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9' },
  date: { fontSize: 14, color: '#64748b', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#64748b' },
  completionCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  completionRate: { fontSize: 56, fontWeight: '800', color: '#22c55e' },
  completionLabel: { fontSize: 16, color: '#94a3b8', marginBottom: 12 },
  progressBar: { width: '100%', height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '44%', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderTopWidth: 3 },
  statValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#64748b' },
  timeCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  timeLabel: { fontSize: 14, color: '#64748b' },
  timeValue: { fontSize: 14, color: '#f1f5f9', fontWeight: '600' },
});
