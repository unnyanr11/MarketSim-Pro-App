import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, SafeAreaView,
} from 'react-native';
import { supabase } from '../lib/client';
import { useAuth } from '../hooks/useAuth';
import { error as logError } from '../lib/logger';

interface DailyRecord {
  date: string;
  completed: number;
  avg_minutes: number | null;
  total_minutes: number;
  on_time: number;
}

interface Props {
  navigation: { goBack: () => void };
}

export function PerformanceScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_staff_performance_history', { p_user_id: user.user_id, p_days: 14 });
      if (error) throw error;
      setRecords((data ?? []) as DailyRecord[]);
    } catch (err) {
      logError('PerformanceScreen.load', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const totalCompleted = records.reduce((a, r) => a + Number(r.completed), 0);
  const avgTime = records.length > 0
    ? records.filter(r => r.avg_minutes).reduce((a, r) => a + (r.avg_minutes ?? 0), 0) / records.filter(r => r.avg_minutes).length
    : 0;
  const onTimeRate = totalCompleted > 0
    ? Math.round((records.reduce((a, r) => a + Number(r.on_time), 0) / totalCompleted) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0ea5e9" />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Performance History</Text>
          <Text style={styles.subtitle}>Last 14 days</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#0ea5e9" style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.grid}>
              <View style={[styles.kpiCard, { borderTopColor: '#22c55e' }]}>
                <Text style={[styles.kpiValue, { color: '#22c55e' }]}>{totalCompleted}</Text>
                <Text style={styles.kpiLabel}>Rooms Cleaned</Text>
              </View>
              <View style={[styles.kpiCard, { borderTopColor: '#0ea5e9' }]}>
                <Text style={[styles.kpiValue, { color: '#0ea5e9' }]}>
                  {avgTime > 0 ? `${avgTime.toFixed(1)}m` : 'N/A'}
                </Text>
                <Text style={styles.kpiLabel}>Avg per Room</Text>
              </View>
              <View style={[styles.kpiCard, { borderTopColor: '#a78bfa' }]}>
                <Text style={[styles.kpiValue, { color: '#a78bfa' }]}>{onTimeRate}%</Text>
                <Text style={styles.kpiLabel}>On-Time Rate</Text>
              </View>
              <View style={[styles.kpiCard, { borderTopColor: '#f59e0b' }]}>
                <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{records.length}</Text>
                <Text style={styles.kpiLabel}>Days Active</Text>
              </View>
            </View>

            {/* Daily Table */}
            <View style={styles.tableCard}>
              <Text style={styles.tableTitle}>📅 Daily Breakdown</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>Date</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader]}>Cleaned</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader]}>Avg (min)</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader]}>On-Time</Text>
              </View>
              {records.length === 0 && (
                <Text style={styles.emptyText}>No records yet. Complete some tasks to see your history.</Text>
              )}
              {records.map((r, idx) => (
                <View key={r.date} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </Text>
                  <Text style={[styles.tableCell, { color: '#22c55e' }]}>{r.completed}</Text>
                  <Text style={styles.tableCell}>{r.avg_minutes ? r.avg_minutes.toFixed(0) : '—'}</Text>
                  <Text style={[styles.tableCell, { color: '#a78bfa' }]}>{r.on_time}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '44%', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderTopWidth: 3 },
  kpiValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  kpiLabel: { fontSize: 12, color: '#64748b' },
  tableCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  tableTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 8, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 8 },
  tableRowAlt: { backgroundColor: '#0f172a33' },
  tableCell: { flex: 1, fontSize: 13, color: '#cbd5e1', textAlign: 'center' },
  tableCellHeader: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingVertical: 24 },
});
