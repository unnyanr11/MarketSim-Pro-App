import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, SafeAreaView, Modal, ActivityIndicator,
  Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { getAllTasksForManager, getFloorTasks, reassignTask } from '../api/tasks';
import { getStaffList } from '../api/user';
import type { HousekeepingTask, User } from '../types';
import { PRIORITY_LABELS } from '../types';

interface Props {
  navigation: { navigate: (s: string, p?: any) => void };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:          '#f59e0b',
  IN_PROGRESS:      '#0ea5e9',
  CLEANED:          '#22c55e',
  DELAYED:          '#ef4444',
  MAINTENANCE_HOLD: '#a855f7',
};

const LABEL_MAP = Object.fromEntries(PRIORITY_LABELS.map(p => [p.value, p]));

// Valid task_status enum values: PENDING | IN_PROGRESS | CLEANED | DELAYED | MAINTENANCE_HOLD
const STATUS_FILTERS = ['ALL', 'PENDING', 'IN_PROGRESS', 'CLEANED', 'DELAYED', 'MAINTENANCE_HOLD'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export function SupervisorScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks]         = useState<HousekeepingTask[]>([]);
  const [staff, setStaff]         = useState<User[]>([]);
  const [loading, setLoading]     = useState(true);
  const [floorFilter, setFloor]   = useState<number | null>(null);
  const [statusFilter, setStatus] = useState<StatusFilter>('ALL');

  // Reassign modal
  const [reassignTask_, setReassignTask] = useState<HousekeepingTask | null>(null);
  const [reassigning, setReassigning]   = useState(false);
  const [expandedFloor, setExpandedFloor] = useState<number | 'unassigned' | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, staffData] = await Promise.all([
        floorFilter !== null ? getFloorTasks(floorFilter) : getAllTasksForManager(),
        getStaffList(),
      ]);
      setTasks(taskData);
      setStaff(staffData);
    } catch (e: any) {
      console.error('[SupervisorScreen loadData]', e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, [floorFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (reassignTask_) {
      const taskFloor = reassignTask_.rooms?.floor_number ?? null;
      setExpandedFloor(taskFloor ?? 'unassigned');
    }
  }, [reassignTask_]);

  const floors = [...new Set(tasks.map(t => t.rooms?.floor_number).filter(Boolean) as number[])].sort();
  const filtered = statusFilter === 'ALL' ? tasks : tasks.filter(t => t.status === statusFilter);

  const stats = {
    total:    tasks.length,
    done:     tasks.filter(t => t.status === 'CLEANED').length,
    pending:  tasks.filter(t => t.status === 'PENDING').length,
    delayed:  tasks.filter(t => t.status === 'DELAYED').length,
    inProg:   tasks.filter(t => t.status === 'IN_PROGRESS').length,
    overdue:  tasks.filter(t => t.status !== 'CLEANED' && t.due_time && new Date(t.due_time) < new Date()).length,
    onHold:   tasks.filter(t => t.status === 'MAINTENANCE_HOLD').length,
  };

  const staffByFloor = useMemo(() => {
    const eligible = staff.filter(
      s => s.role === 'HOUSEKEEPING' && s.user_id !== reassignTask_?.assigned_to,
    );
    const groups: Map<number | 'unassigned', User[]> = new Map();
    for (const s of eligible) {
      const key: number | 'unassigned' = s.assigned_floor ?? 'unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'unassigned') return 1;
      if (b === 'unassigned') return -1;
      return (a as number) - (b as number);
    });
  }, [staff, reassignTask_]);

  const taskFloor = reassignTask_?.rooms?.floor_number ?? null;

  const handleReassign = useCallback(async (taskToReassign: HousekeepingTask, newStaff: User) => {
    if (!user) return;
    const isCrossFloor = newStaff.assigned_floor !== null &&
                         newStaff.assigned_floor !== undefined &&
                         newStaff.assigned_floor !== taskFloor;

    const doReassign = async () => {
      setReassigning(true);
      try {
        const result = await reassignTask(taskToReassign.task_id, newStaff.user_id, user.user_id);
        if (result.success) {
          setReassignTask(null);
          const displayName = result.newStaffName ?? newStaff.full_name;
          Alert.alert(
            'Reassigned ✅',
            `Task moved to ${displayName}${isCrossFloor ? ` (Floor ${newStaff.assigned_floor})` : ''}.`,
          );
          loadData();
        } else {
          Alert.alert('Reassignment Failed', result.error ?? 'Could not reassign task. Please try again.');
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'An unexpected error occurred.');
      } finally {
        setReassigning(false);
      }
    };

    if (isCrossFloor) {
      Alert.alert(
        '⚠️ Cross-Floor Reassignment',
        `${newStaff.full_name} is assigned to Floor ${newStaff.assigned_floor}, but this task is on Floor ${taskFloor}.\n\nReassign anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reassign', style: 'default', onPress: doReassign },
        ],
      );
    } else {
      doReassign();
    }
  }, [user, loadData, taskFloor]);

  const renderTask = ({ item }: { item: HousekeepingTask }) => {
    const sc    = STATUS_COLOR[item.status] ?? '#94a3b8';
    const label = LABEL_MAP[item.priority_label ?? 'STANDARD'];
    const isOverdue = item.due_time && item.status !== 'CLEANED' && new Date(item.due_time) < new Date();
    // Tasks on MAINTENANCE_HOLD or CLEANED cannot be reassigned
    const canReassign = item.status !== 'CLEANED' && item.status !== 'MAINTENANCE_HOLD';

    return (
      <View style={[S.card, isOverdue && S.cardOverdue]}>
        <View style={S.cardRow}>
          <View style={S.cardLeft}>
            <Text style={S.roomNum}>Room {item.rooms?.room_number ?? item.room_id}</Text>
            <Text style={S.staffName}>{item.staff?.full_name ?? 'Unassigned'}</Text>
            <View style={S.tagRow}>
              <View style={[S.statusPill, { backgroundColor: sc + '22', borderColor: sc }]}>
                <Text style={[S.statusPillText, { color: sc }]}>{item.status.replace('_', ' ')}</Text>
              </View>
              <View style={[S.labelTag, { backgroundColor: (label?.color ?? '#475569') + '22', borderColor: label?.color ?? '#475569' }]}>
                <Text style={S.labelTagEmoji}>{label?.emoji ?? '🧹'}</Text>
                <Text style={[S.labelTagText, { color: label?.color ?? '#475569' }]}>{label?.label ?? 'Standard'}</Text>
              </View>
              {isOverdue && <View style={S.overdueTag}><Text style={S.overdueTagText}>⏰ OVERDUE</Text></View>}
            </View>
          </View>
          {canReassign ? (
            <TouchableOpacity style={S.reassignBtn} onPress={() => setReassignTask(item)}>
              <Text style={S.reassignBtnText}>🔄 Reassign</Text>
            </TouchableOpacity>
          ) : (
            <View style={S.reassignBtnDisabled}>
              <Text style={S.reassignBtnDisabledText}>
                {item.status === 'CLEANED' ? '✅ Done' : '🔧 On Hold'}
              </Text>
            </View>
          )}
        </View>
        {item.due_time && (
          <Text style={[S.dueText, isOverdue && { color: '#ef4444' }]}>
            Due: {new Date(item.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Text style={S.headerTitle}>Supervisor View</Text>
        <Text style={S.headerRole}>{user?.role}</Text>
      </View>

      <View style={S.statsRow}>
        <Stat label="Total"   value={stats.total}   color="#94a3b8" />
        <Stat label="Done"    value={stats.done}    color="#22c55e" />
        <Stat label="Active"  value={stats.inProg}  color="#0ea5e9" />
        <Stat label="Delayed" value={stats.delayed} color="#f59e0b" />
        <Stat label="Overdue" value={stats.overdue} color="#ef4444" />
        <Stat label="On Hold" value={stats.onHold}  color="#a855f7" />
      </View>

      {/* Floor filter */}
      <View style={S.filterRow}>
        <TouchableOpacity
          onPress={() => setFloor(null)}
          style={[S.filterChip, floorFilter === null && S.filterActive]}
        >
          <Text style={[S.filterText, floorFilter === null && { color: '#fff' }]}>All Floors</Text>
        </TouchableOpacity>
        {floors.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFloor(f)}
            style={[S.filterChip, floorFilter === f && S.filterActive]}
          >
            <Text style={[S.filterText, floorFilter === f && { color: '#fff' }]}>Floor {f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status filter */}
      <View style={S.filterRow}>
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatus(s)}
            style={[S.filterChip, statusFilter === s && S.filterActive]}
          >
            <Text style={[S.filterText, statusFilter === s && { color: '#fff' }]}>
              {s === 'ALL' ? 'All' : s === 'MAINTENANCE_HOLD' ? 'On Hold' : s.replace('_', ' ')}
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
          <RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#0ea5e9" colors={['#0ea5e9']} />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={S.empty}>
              <Text style={S.emptyIcon}>📋</Text>
              <Text style={S.emptyTitle}>No tasks found</Text>
            </View>
          )
        }
      />

      {/* ── Reassign Modal ── */}
      <Modal
        visible={!!reassignTask_}
        transparent
        animationType="slide"
        onRequestClose={() => !reassigning && setReassignTask(null)}
      >
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>🔄 Reassign Task</Text>
            <Text style={S.modalSub}>
              Room {reassignTask_?.rooms?.room_number ?? reassignTask_?.room_id}
              {taskFloor != null ? ` · Floor ${taskFloor}` : ''} — pick a staff member:
            </Text>

            {reassigning && (
              <View style={S.spinnerWrap}>
                <ActivityIndicator color="#0ea5e9" size="large" />
                <Text style={S.spinnerText}>Reassigning…</Text>
              </View>
            )}

            {!reassigning && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {staffByFloor.length === 0 && (
                  <Text style={S.noStaff}>No other staff available.</Text>
                )}
                {staffByFloor.map(([floorKey, members]) => {
                  const isOwn      = floorKey === taskFloor;
                  const isCross    = !isOwn;
                  const isExpanded = expandedFloor === floorKey;
                  const floorLabel = floorKey === 'unassigned' ? 'No Floor Assigned' : `Floor ${floorKey}`;
                  return (
                    <View key={String(floorKey)} style={S.floorGroup}>
                      <TouchableOpacity
                        style={[S.floorHeader, isOwn && S.floorHeaderOwn]}
                        onPress={() => setExpandedFloor(isExpanded ? null : floorKey)}
                        activeOpacity={0.7}
                      >
                        <View style={S.floorHeaderLeft}>
                          <Text style={[S.floorLabel, isOwn && S.floorLabelOwn]}>{floorLabel}</Text>
                          {isCross
                            ? <View style={S.crossBadge}><Text style={S.crossBadgeText}>Cross-floor</Text></View>
                            : <View style={S.sameBadge}><Text style={S.sameBadgeText}>Same floor</Text></View>}
                        </View>
                        <Text style={S.floorChevron}>{isExpanded ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                      {isExpanded && members.map(s => (
                        <TouchableOpacity
                          key={s.user_id}
                          style={[S.staffRow, isCross && S.staffRowCross]}
                          onPress={() => reassignTask_ && handleReassign(reassignTask_, s)}
                        >
                          <View style={[S.staffAvatar, isCross && S.staffAvatarCross]}>
                            <Text style={[S.staffAvatarText, isCross && { color: '#f59e0b' }]}>
                              {s.full_name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={S.staffRowName}>{s.full_name}</Text>
                            <Text style={S.staffRowSub}>
                              {s.assigned_floor != null ? `Floor ${s.assigned_floor} · ` : ''}@{s.username}
                            </Text>
                          </View>
                          {isCross && <Text style={S.crossArrow}>⇄</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[S.cancelBtn, reassigning && S.cancelBtnDisabled]}
              onPress={() => !reassigning && setReassignTask(null)}
              disabled={reassigning}
            >
              <Text style={S.cancelBtnText}>{reassigning ? 'Please wait…' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={S.stat}>
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  safe:                 { flex: 1, backgroundColor: '#0f172a' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerTitle:          { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  headerRole:           { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  statsRow:             { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1e293b', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  stat:                 { alignItems: 'center' },
  statValue:            { fontSize: 20, fontWeight: '800' },
  statLabel:            { fontSize: 11, color: '#64748b', marginTop: 2 },
  filterRow:            { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  filterChip:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  filterActive:         { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  filterText:           { fontSize: 12, color: '#64748b' },
  list:                 { padding: 12, paddingBottom: 32 },
  card:                 { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 10, padding: 14 },
  cardOverdue:          { borderWidth: 1, borderColor: '#ef444466' },
  cardRow:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:             { flex: 1 },
  roomNum:              { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 2 },
  staffName:            { fontSize: 13, color: '#64748b', marginBottom: 8 },
  tagRow:               { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusPill:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusPillText:       { fontSize: 11, fontWeight: '600' },
  labelTag:             { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  labelTagEmoji:        { fontSize: 11 },
  labelTagText:         { fontSize: 11, fontWeight: '600' },
  overdueTag:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#ef444422', borderWidth: 1, borderColor: '#ef4444' },
  overdueTagText:       { fontSize: 11, fontWeight: '700', color: '#ef4444' },
  reassignBtn:          { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0ea5e922', borderRadius: 8, borderWidth: 1, borderColor: '#0ea5e9' },
  reassignBtnText:      { color: '#0ea5e9', fontSize: 13, fontWeight: '600' },
  reassignBtnDisabled:  { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  reassignBtnDisabledText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  dueText:              { fontSize: 12, color: '#64748b', marginTop: 8 },
  empty:                { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon:            { fontSize: 40 },
  emptyTitle:           { fontSize: 16, fontWeight: '600', color: '#64748b' },
  noStaff:              { color: '#64748b', textAlign: 'center', paddingVertical: 20 },
  spinnerWrap:          { alignItems: 'center', paddingVertical: 24, gap: 10 },
  spinnerText:          { color: '#64748b', fontSize: 14 },
  modalOverlay:         { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  modalSheet:           { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalTitle:           { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  modalSub:             { fontSize: 14, color: '#64748b', marginBottom: 16 },
  floorGroup:           { marginBottom: 8 },
  floorHeader:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  floorHeaderOwn:       { backgroundColor: '#0ea5e915', borderWidth: 1, borderColor: '#0ea5e944' },
  floorHeaderLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  floorLabel:           { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  floorLabelOwn:        { color: '#0ea5e9' },
  floorChevron:         { fontSize: 10, color: '#475569' },
  crossBadge:           { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f59e0b22', borderWidth: 1, borderColor: '#f59e0b' },
  crossBadgeText:       { fontSize: 10, fontWeight: '700', color: '#f59e0b' },
  sameBadge:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#0ea5e922', borderWidth: 1, borderColor: '#0ea5e9' },
  sameBadgeText:        { fontSize: 10, fontWeight: '700', color: '#0ea5e9' },
  staffRow:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  staffRowCross:        { backgroundColor: '#f59e0b08' },
  staffAvatar:          { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0ea5e933', alignItems: 'center', justifyContent: 'center' },
  staffAvatarCross:     { backgroundColor: '#f59e0b22' },
  staffAvatarText:      { fontSize: 18, fontWeight: '700', color: '#0ea5e9' },
  staffRowName:         { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  staffRowSub:          { fontSize: 12, color: '#64748b', marginTop: 2 },
  crossArrow:           { fontSize: 18, color: '#f59e0b' },
  cancelBtn:            { marginTop: 16, paddingVertical: 14, backgroundColor: '#0f172a', borderRadius: 10, alignItems: 'center' },
  cancelBtnDisabled:    { opacity: 0.4 },
  cancelBtnText:        { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
