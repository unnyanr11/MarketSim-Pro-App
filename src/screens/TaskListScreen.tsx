import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, SafeAreaView, Switch,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { getMyTasks, getAllTasksForManager, getOptimizedRoute } from '../api/tasks';
import type { HousekeepingTask, RoomPriorityLabel } from '../types';
import { PRIORITY_LABELS } from '../types';

interface Props {
  navigation: { navigate: (screen: string, params?: any) => void };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', IN_PROGRESS: '#0ea5e9', CLEANED: '#22c55e',
  DELAYED: '#ef4444', SKIPPED: '#64748b',
};

const LABEL_MAP = Object.fromEntries(PRIORITY_LABELS.map(p => [p.value, p]));

export function TaskListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const role      = user?.role ?? 'HOUSEKEEPING';
  const isElevated = role === 'MANAGER' || role === 'ADMIN';

  const [tasks, setTasks]         = useState<HousekeepingTask[]>([]);
  const [loading, setLoading]     = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [filter, setFilter]       = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'CLEANED' | 'DELAYED'>('ALL');

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let data: HousekeepingTask[];
    if (isElevated) {
      // Managers / Admins: fetch every task hotel-wide
      data = await getAllTasksForManager();
    } else if (routeMode) {
      data = await getOptimizedRoute(user.user_id);
    } else {
      data = await getMyTasks(user.user_id);
    }
    setTasks(data);
    setLoading(false);
  }, [user, routeMode, isElevated]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const filtered = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);

  const renderTask = ({ item, index }: { item: HousekeepingTask; index: number }) => {
    const sc    = STATUS_COLOR[item.status] ?? '#94a3b8';
    const label = LABEL_MAP[item.priority_label ?? 'STANDARD'];
    const isOverdue = item.due_time && item.status !== 'CLEANED' && new Date(item.due_time) < new Date();

    return (
      <TouchableOpacity
        style={[S.card, isOverdue && S.cardOverdue]}
        onPress={() => navigation.navigate('TaskDetail', { task: item })}
        activeOpacity={0.8}
      >
        {routeMode && !isElevated && (
          <View style={S.routeIndex}>
            <Text style={S.routeIndexText}>{index + 1}</Text>
          </View>
        )}
        <View style={S.cardBody}>
          <View style={S.cardTop}>
            <Text style={S.roomNumber}>
              Room {item.rooms?.room_number ?? item.room_id}
            </Text>
            <View style={[S.statusPill, { backgroundColor: sc + '22', borderColor: sc }]}>
              <Text style={[S.statusPillText, { color: sc }]}>{item.status.replace('_', ' ')}</Text>
            </View>
          </View>

          <View style={S.metaRow}>
            <Text style={S.metaText}>Floor {item.rooms?.floor_number ?? '?'}</Text>
            <Text style={S.metaDot}>·</Text>
            <Text style={S.metaText}>{item.rooms?.room_type ?? '—'}</Text>
            <Text style={S.metaDot}>·</Text>
            <Text style={S.metaText}>{item.estimated_minutes} min</Text>
            {/* Show assigned staff name for managers */}
            {isElevated && (item as any).staff && (
              <>
                <Text style={S.metaDot}>·</Text>
                <Text style={S.metaText}>
                  👤 {(item as any).staff?.full_name ?? (item as any).staff?.username ?? 'Unassigned'}
                </Text>
              </>
            )}
          </View>

          <View style={S.tagRow}>
            <View style={[S.labelTag, { backgroundColor: (label?.color ?? '#475569') + '22', borderColor: label?.color ?? '#475569' }]}>
              <Text style={S.labelTagEmoji}>{label?.emoji ?? '🧹'}</Text>
              <Text style={[S.labelTagText, { color: label?.color ?? '#475569' }]}>{label?.label ?? 'Standard'}</Text>
            </View>
            {isOverdue && (
              <View style={S.overdueTag}>
                <Text style={S.overdueTagText}>⏰ OVERDUE</Text>
              </View>
            )}
            {item.access_status !== 'ACCESSIBLE' && (
              <View style={S.dndTag}>
                <Text style={S.dndTagText}>
                  {item.access_status === 'DND' ? '🚫 DND'
                    : item.access_status === 'GUEST_PRESENT' ? '👤 Occupied'
                    : '⛔ Refused'}
                </Text>
              </View>
            )}
          </View>

          {item.due_time && (
            <Text style={[S.dueText, isOverdue && S.dueTextOverdue]}>
              Due: {new Date(item.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={S.safe}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerTitle}>{isElevated ? 'All Tasks' : 'My Tasks'}</Text>
        <Text style={S.headerCount}>{filtered.length}</Text>
      </View>

      {/* Route toggle — only relevant for staff, not managers */}
      {!isElevated && (
        <View style={S.routeToggleRow}>
          <View>
            <Text style={S.routeToggleLabel}>🚶 Optimised Cleaning Route</Text>
            <Text style={S.routeToggleSub}>Sorts by checkout → VIP → standard</Text>
          </View>
          <Switch
            value={routeMode}
            onValueChange={setRouteMode}
            trackColor={{ false: '#334155', true: '#0ea5e9' }}
            thumbColor={routeMode ? '#fff' : '#94a3b8'}
          />
        </View>
      )}

      {/* Status filter */}
      <View style={S.filterRow}>
        {(['ALL','PENDING','IN_PROGRESS','CLEANED','DELAYED'] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[S.filterChip, filter === f && S.filterChipActive]}
          >
            <Text style={[S.filterChipText, filter === f && { color: '#fff' }]}>
              {f === 'ALL' ? 'All' : f.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.task_id)}
        renderItem={renderTask}
        contentContainerStyle={S.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadTasks}
            tintColor="#0ea5e9"
            colors={['#0ea5e9']}
          />
        }
        ListEmptyComponent={
          <View style={S.empty}>
            <Text style={S.emptyIcon}>🛌</Text>
            <Text style={S.emptyTitle}>{loading ? 'Loading tasks…' : 'No tasks here'}</Text>
            <Text style={S.emptyBody}>
              {!loading && (isElevated
                ? 'No tasks found hotel-wide. Pull down to refresh.'
                : 'Pull down to refresh or check with your supervisor.')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#0f172a' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerTitle:        { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  headerCount:        { fontSize: 22, fontWeight: '800', color: '#0ea5e9' },
  routeToggleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  routeToggleLabel:   { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  routeToggleSub:     { fontSize: 12, color: '#64748b', marginTop: 2 },
  filterRow:          { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  filterChip:         { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  filterChipActive:   { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  filterChipText:     { fontSize: 12, color: '#64748b' },
  list:               { padding: 12, paddingBottom: 32 },
  card:               { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 10, padding: 14, flexDirection: 'row', gap: 12 },
  cardOverdue:        { borderWidth: 1, borderColor: '#ef444488' },
  cardBody:           { flex: 1 },
  routeIndex:         { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  routeIndexText:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardTop:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roomNumber:         { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  statusPill:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusPillText:     { fontSize: 11, fontWeight: '600' },
  metaRow:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  metaText:           { fontSize: 13, color: '#64748b' },
  metaDot:            { color: '#475569' },
  tagRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  labelTag:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  labelTagEmoji:      { fontSize: 12 },
  labelTagText:       { fontSize: 11, fontWeight: '600' },
  overdueTag:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#ef444422', borderWidth: 1, borderColor: '#ef4444' },
  overdueTagText:     { fontSize: 11, fontWeight: '700', color: '#ef4444' },
  dndTag:             { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#f59e0b22', borderWidth: 1, borderColor: '#f59e0b' },
  dndTagText:         { fontSize: 11, fontWeight: '600', color: '#f59e0b' },
  dueText:            { fontSize: 12, color: '#64748b', marginTop: 4 },
  dueTextOverdue:     { color: '#ef4444', fontWeight: '600' },
  empty:              { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon:          { fontSize: 48 },
  emptyTitle:         { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  emptyBody:          { fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 260 },
});
