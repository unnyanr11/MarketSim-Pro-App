import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { supabase } from '../lib/client';
import { error as logError } from '../lib/logger';

interface StaffSummary {
  user_id: number;
  full_name: string;
  assigned_floor: string | null;
  total_completed: number;
  on_time: number;
  on_time_rate: number;
  avg_minutes: number | null;
  last_active: string | null;
}

interface DailyRecord {
  date: string;
  completed: number;
  avg_minutes: number | null;
  on_time: number;
}

interface Props {
  navigation: { goBack: () => void };
}

export function StaffPerformanceScreen({ navigation }: Props) {
  const [staffList, setStaffList] = useState<StaffSummary[]>([]);
  const [selected, setSelected] = useState<StaffSummary | null>(null);
  const [drillData, setDrillData] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_staff_performance', { p_days: 14 });
      if (error) throw error;
      setStaffList((data ?? []) as StaffSummary[]);
    } catch (err) {
      logError('StaffPerformanceScreen.loadSummary', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  const loadDrill = useCallback(async (staffMember: StaffSummary) => {
    setSelected(staffMember);
    setDrillLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_staff_performance_history', { p_user_id: staffMember.user_id, p_days: 14 });
      if (error) throw error;
      setDrillData((data ?? []) as DailyRecord[]);
    } catch (err) {
      logError('StaffPerformanceScreen.loadDrill', err);
    } finally {
      setDrillLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const onTimeColor = (rate: number) =>
    rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444';

  // ── Drill-down view ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.drillHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.drillName}>{selected.full_name}</Text>
            <Text style={styles.drillSub}>
              {selected.assigned_floor ? `Floor ${selected.assigned_floor}` : 'No floor'} · Last 14 days
            </Text>
          </View>
        </View>

        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* KPI row */}
          <View style={styles.grid}>
            <View style={[styles.kpiCard, { borderTopColor: '#22c55e' }]}>
              <Text style={[styles.kpiValue, { color: '#22c55e' }]}>{selected.total_completed}</Text>
              <Text style={styles.kpiLabel}>Rooms Cleaned</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: onTimeColor(selected.on_time_rate) }]}>
              <Text style={[styles.kpiValue, { color: onTimeColor(selected.on_time_rate) }]}>
                {selected.on_time_rate}%
              </Text>
              <Text style={styles.kpiLabel}>On-Time Rate</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: '#0ea5e9' }]}>
              <Text style={[styles.kpiValue, { color: '#0ea5e9' }]}>
                {selected.avg_minutes ? `${Number(selected.avg_minutes).toFixed(1)}m` : 'N/A'}
              </Text>
              <Text style={styles.kpiLabel}>Avg per Room</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: '#a78bfa' }]}>
              <Text style={[styles.kpiValue, { color: '#a78bfa' }]}>
                {selected.last_active
                  ? new Date(selected.last_active).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                  : '—'}
              </Text>
              <Text style={styles.kpiLabel}>Last Active</Text>
            </View>
          </View>

          {/* Daily table */}
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>📅 Daily Breakdown</Text>
            {drillLoading ? (
              <ActivityIndicator color="#0ea5e9" style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>Date</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader]}>Cleaned</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader]}>Avg (min)</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader]}>On-Time</Text>
                </View>
                {drillData.length === 0 && (
                  <Text style={styles.emptyText}>No completed tasks in this period.</Text>
                )}
                {drillData.map((r, idx) => (
                  <View key={r.date} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>
                      {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </Text>
                    <Text style={[styles.tableCell, { color: '#22c55e' }]}>{r.completed}</Text>
                    <Text style={styles.tableCell}>{r.avg_minutes ? Number(r.avg_minutes).toFixed(0) : '—'}</Text>
                    <Text style={[styles.tableCell, { color: '#a78bfa' }]}>{r.on_time}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Overview list ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSummary(true)} tintColor="#0ea5e9" />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Staff Performance</Text>
          <Text style={styles.subtitle}>All housekeeping staff · Last 14 days</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#0ea5e9" style={{ marginTop: 60 }} />
        ) : staffList.length === 0 ? (
          <Text style={styles.emptyText}>No active housekeeping staff found.</Text>
        ) : (
          staffList.map(s => (
            <TouchableOpacity
              key={s.user_id}
              style={styles.staffCard}
              onPress={() => loadDrill(s)}
              activeOpacity={0.7}
            >
              <View style={styles.staffCardLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {s.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{s.full_name}</Text>
                  <Text style={styles.staffSub}>
                    {s.assigned_floor ? `Floor ${s.assigned_floor}` : 'No floor assigned'}
                  </Text>
                </View>
              </View>

              <View style={styles.staffStats}>
                <View style={styles.statBadge}>
                  <Text style={[styles.statValue, { color: '#22c55e' }]}>{s.total_completed}</Text>
                  <Text style={styles.statLabel}>Done</Text>
                </View>
                <View style={styles.statBadge}>
                  <Text style={[styles.statValue, { color: onTimeColor(s.on_time_rate) }]}>
                    {s.on_time_rate}%
                  </Text>
                  <Text style={styles.statLabel}>On-Time</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          ))
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

  // Staff card
  staffCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  staffCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  staffSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  staffStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statBadge: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#64748b', marginTop: 1 },
  chevron: { fontSize: 22, color: '#334155', marginLeft: 4 },

  // Drill header
  drillHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f172a', padding: 16, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backBtnText: { color: '#0ea5e9', fontSize: 15, fontWeight: '600' },
  drillName: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  drillSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  // KPI grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '44%', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderTopWidth: 3 },
  kpiValue: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  kpiLabel: { fontSize: 12, color: '#64748b' },

  // Table
  tableCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  tableTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 8, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 8 },
  tableRowAlt: { backgroundColor: '#0f172a33' },
  tableCell: { flex: 1, fontSize: 13, color: '#cbd5e1', textAlign: 'center' },
  tableCellHeader: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingVertical: 24 },
});
