import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTaskTimer } from '../hooks/useTaskTimer';
import {
  startTask,
  completeTaskWithChecklist,
  updateTaskAccessStatus,
  uploadTaskPhoto,
  requestHelp,
  skipTask,
  updatePriorityLabel,
  getTaskById,
} from '../api/tasks';
import { PhotoCapture } from '../components/PhotoCapture';
import type { HousekeepingTask, ChecklistItem, AccessStatus, RoomPriorityLabel } from '../types';
import { DEFAULT_CHECKLIST, PRIORITY_LABELS } from '../types';

interface Props {
  route: { params: { task: HousekeepingTask } };
  navigation: { goBack: () => void; navigate: (name: string, params?: any) => void };
}

const ACCESS_OPTIONS: { label: string; value: AccessStatus; color: string; emoji: string }[] = [
  { label: 'Accessible',      value: 'ACCESSIBLE',     color: '#22c55e', emoji: '✅' },
  { label: 'Do Not Disturb',  value: 'DND',            color: '#ef4444', emoji: '🚫' },
  { label: 'Guest Present',   value: 'GUEST_PRESENT',  color: '#f59e0b', emoji: '👤' },
  { label: 'Refused Service', value: 'REFUSED_SERVICE',color: '#dc2626', emoji: '⛔' },
];

export function TaskDetailScreen({ route, navigation }: Props) {
  const { user } = useAuth();

  // Live task state — re-fetch on every mount so started_at is always current
  const [task, setTask] = useState<HousekeepingTask>(route.params.task);
  const [fetchingTask, setFetchingTask] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const live = await getTaskById(route.params.task.task_id);
      if (!cancelled && live) setTask(live);
      if (!cancelled) setFetchingTask(false);
    })();
    return () => { cancelled = true; };
  }, [route.params.task.task_id]);

  const [taskStatus, setTaskStatus]             = useState(task.status);
  useEffect(() => { setTaskStatus(task.status); }, [task.status]);

  const [loading, setLoading]                   = useState(false);
  const [checklist, setChecklist]               = useState<ChecklistItem[]>(
    task.checklist_data?.length ? task.checklist_data : DEFAULT_CHECKLIST,
  );
  const [completionNotes, setNotes]             = useState('');
  const [accessStatus, setAccessStatus]         = useState<AccessStatus>(task.access_status ?? 'ACCESSIBLE');
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [showLabelPicker, setShowLabelPicker]   = useState(false);

  // Timer — driven by started_at from DB
  const { timerLabel, isOvertime, progressRatio } = useTaskTimer({
    startedAt:     task.started_at,
    budgetMinutes: task.estimated_minutes ?? 30,
    running:       taskStatus === 'IN_PROGRESS',
  });

  // Derived
  const isCheckout        = task.priority_label === 'CHECKOUT';
  const photoRequired     = isCheckout;
  const photoSatisfied    = !photoRequired || uploadedPhotoUrls.length >= 1;
  const allChecked        = checklist.every(i => i.done);
  const completedCount    = checklist.filter(i => i.done).length;
  const completionPercent = Math.round((completedCount / checklist.length) * 100);
  const priorityMeta      = PRIORITY_LABELS.find(p => p.value === (task.priority_label ?? 'STANDARD'));
  const canComplete       = allChecked && photoSatisfied;
  const roomLabel         = task.rooms?.room_number ?? `Room ${task.room_id}`;
  const isSupervisor      = user?.role === 'SUPERVISOR' || user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const statusColor = {
    PENDING: '#f59e0b', IN_PROGRESS: '#0ea5e9', CLEANED: '#22c55e',
    DELAYED: '#ef4444', SKIPPED: '#64748b',
  }[taskStatus] ?? '#94a3b8';

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleCheck = (id: string) =>
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));

  const handleStart = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const ok  = await startTask(task.task_id, user.user_id);
    if (ok) {
      setTask(prev => ({ ...prev, status: 'IN_PROGRESS', started_at: now }));
      setTaskStatus('IN_PROGRESS');
    } else {
      Alert.alert('Error', 'Could not start task. Try again.');
    }
  }, [task.task_id, user]);

  const handleComplete = useCallback(async () => {
    if (!user) return;
    if (!allChecked)     { Alert.alert('Incomplete Checklist', 'Tick off all items before completing.'); return; }
    if (!photoSatisfied) { Alert.alert('Photo Required', 'Checkout rooms require at least 1 photo.'); return; }
    Alert.alert('Complete Task', 'Mark this room as cleaned?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          setLoading(true);
          const ok = await completeTaskWithChecklist(
            task.task_id, user.user_id, checklist,
            completionNotes || undefined, uploadedPhotoUrls,
          );
          setLoading(false);
          if (ok) {
            setTaskStatus('CLEANED');
            Alert.alert('✅ Done!', 'Room marked as cleaned.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } else {
            Alert.alert('Error', 'Could not complete task.');
          }
        },
      },
    ]);
  }, [user, task.task_id, checklist, completionNotes, allChecked, photoSatisfied, uploadedPhotoUrls, navigation]);

  const handleAccessChange = useCallback(async (status: AccessStatus) => {
    if (!user) return;
    setAccessStatus(status);
    const ok = await updateTaskAccessStatus(task.task_id, user.user_id, status);
    if (!ok) Alert.alert('Error', 'Could not update room access status.');
    if (status !== 'ACCESSIBLE') {
      Alert.alert('Room Flagged',
        status === 'DND'              ? 'Do Not Disturb flag set. Task rescheduled for later.'
        : status === 'REFUSED_SERVICE' ? 'Guest refused service noted. Supervisor will be notified.'
        :                                'Guest present noted. Come back later.',
      );
    }
  }, [task.task_id, user]);

  const handleRequestHelp = useCallback(async () => {
    if (!user) return;
    Alert.alert('Request Help', 'Send a help request to your supervisor?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
          const ok = await requestHelp(task.task_id, user.user_id);
          ok ? Alert.alert('📞 Help Requested', 'Your supervisor has been notified.')
             : Alert.alert('Error', 'Could not send help request.');
        },
      },
    ]);
  }, [task.task_id, user]);

  const handleSkip = useCallback(() => {
    Alert.prompt('Skip Room', 'Please provide a reason for skipping:',
      async (reason) => {
        if (!user || !reason?.trim()) return;
        const ok = await skipTask(task.task_id, user.user_id, reason.trim());
        if (ok) {
          setTaskStatus('SKIPPED');
          Alert.alert('Skipped', 'Room has been skipped.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          Alert.alert('Error', 'Could not skip task.');
        }
      }, 'plain-text',
    );
  }, [task.task_id, user, navigation]);

  const handleLabelChange = useCallback(async (label: RoomPriorityLabel) => {
    const ok = await updatePriorityLabel(task.task_id, label);
    if (ok) { setShowLabelPicker(false); Alert.alert('Updated', `Room label set to ${label.replace('_', ' ')}.`); }
  }, [task.task_id]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (fetchingTask) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={S.loadingText}>Loading task…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      <ScrollView style={S.container} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* HEADER */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Text style={S.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>Room {roomLabel}</Text>
          <View style={[S.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[S.statusText, { color: statusColor }]}>{taskStatus.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* TIMER BANNER */}
        {taskStatus === 'IN_PROGRESS' && (
          <View style={[S.timerBanner, isOvertime && S.timerBannerOver]}>
            <View>
              <Text style={S.timerSubLabel}>
                {isOvertime ? '⚠️ Over estimated time' : '⏱ Time remaining'}
              </Text>
              <Text style={[S.timerValue, isOvertime && S.timerValueOver]}>
                {timerLabel}
              </Text>
            </View>
            <View style={S.timerRight}>
              <Text style={S.timerBudgetLabel}>Budget</Text>
              <Text style={S.timerBudgetValue}>{task.estimated_minutes ?? 30} min</Text>
            </View>
          </View>
        )}
        {taskStatus === 'IN_PROGRESS' && (
          <View style={S.timerProgressTrack}>
            <View style={[
              S.timerProgressFill,
              { width: `${Math.round(progressRatio * 100)}%` as any,
                backgroundColor: isOvertime ? '#ef4444' : progressRatio > 0.8 ? '#f59e0b' : '#0ea5e9' },
            ]} />
          </View>
        )}

        {/* PRIORITY LABEL */}
        <View style={S.card}>
          <View style={S.rowBetween}>
            <Text style={S.cardTitle}>Room Priority</Text>
            {isSupervisor && (
              <TouchableOpacity onPress={() => setShowLabelPicker(!showLabelPicker)}>
                <Text style={S.editLink}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[S.labelBadge, { backgroundColor: (priorityMeta?.color ?? '#475569') + '22', borderColor: priorityMeta?.color ?? '#475569' }]}>
            <Text style={{ fontSize: 18 }}>{priorityMeta?.emoji ?? '🧹'}</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={[S.labelTitle, { color: priorityMeta?.color ?? '#475569' }]}>{priorityMeta?.label ?? 'Standard'}</Text>
              <Text style={S.labelDesc}>{priorityMeta?.desc ?? 'Regular daily cleaning'}</Text>
            </View>
          </View>
          {showLabelPicker && (
            <View style={S.labelGrid}>
              {PRIORITY_LABELS.map(pl => (
                <TouchableOpacity
                  key={pl.value}
                  onPress={() => handleLabelChange(pl.value)}
                  style={[S.labelOption, task.priority_label === pl.value && { borderColor: pl.color, backgroundColor: pl.color + '22' }]}
                >
                  <Text style={{ fontSize: 16 }}>{pl.emoji}</Text>
                  <Text style={[S.labelOptionText, task.priority_label === pl.value && { color: pl.color }]}>{pl.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* TASK DETAILS */}
        <View style={S.card}>
          <Text style={S.cardTitle}>Task Details</Text>
          <Row label="Floor"     value={String(task.rooms?.floor_number ?? '—')} />
          <Row label="Room Type" value={task.rooms?.room_type ?? '—'} />
          <Row label="Priority"  value={`${task.priority} / 5`} />
          <Row label="Est. Time" value={`${task.estimated_minutes ?? 30} min`} />
          {task.due_time && <Row label="Due" value={new Date(task.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />}
          {task.staff    && <Row label="Staff" value={task.staff.full_name} />}
          {task.notes    && <Row label="Notes" value={task.notes} />}
        </View>

        {/* ROOM ACCESS */}
        <View style={S.card}>
          <Text style={S.cardTitle}>Room Access Status</Text>
          <View style={S.accessGrid}>
            {ACCESS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => handleAccessChange(opt.value)}
                style={[S.accessBtn, accessStatus === opt.value && { backgroundColor: opt.color + '22', borderColor: opt.color }]}
              >
                <Text style={S.accessEmoji}>{opt.emoji}</Text>
                <Text style={[S.accessBtnText, accessStatus === opt.value && { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {accessStatus !== 'ACCESSIBLE' && (
            <View style={S.dndWarning}>
              <Text style={S.dndWarningText}>
                {accessStatus === 'DND'
                  ? '🚫 DND active — task delayed. Retry after 30 min or contact supervisor.'
                  : accessStatus === 'GUEST_PRESENT'
                  ? '👤 Guest in room. Return later or contact front desk.'
                  : '⛔ Guest refused service. This has been flagged to your supervisor.'}
              </Text>
            </View>
          )}
        </View>

        {/* CHECKLIST */}
        {accessStatus === 'ACCESSIBLE' && (
          <View style={S.card}>
            <View style={S.rowBetween}>
              <Text style={S.cardTitle}>Cleaning Checklist</Text>
              <Text style={S.progressLabel}>{completedCount}/{checklist.length}</Text>
            </View>
            <View style={S.progressBar}>
              <View style={[S.progressFill, { width: `${completionPercent}%` as any }]} />
            </View>
            {(['bed','bathroom','amenities','general'] as const).map(cat => (
              <View key={cat}>
                <Text style={S.checkCategory}>{cat.toUpperCase()}</Text>
                {checklist.filter(i => i.category === cat).map(item => (
                  <TouchableOpacity key={item.id} onPress={() => toggleCheck(item.id)} style={S.checkItem}>
                    <View style={[S.checkbox, item.done && S.checkboxDone]}>
                      {item.done && <Text style={S.checkmark}>✓</Text>}
                    </View>
                    <Text style={[S.checkLabel, item.done && S.checkLabelDone]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <TextInput
              placeholder="Completion notes (optional)"
              placeholderTextColor="#475569"
              value={completionNotes}
              onChangeText={setNotes}
              multiline
              style={S.notesInput}
            />
          </View>
        )}

        {/* PHOTO CAPTURE */}
        {accessStatus === 'ACCESSIBLE' && taskStatus === 'IN_PROGRESS' && (
          <View style={S.card}>
            <PhotoCapture
              taskId={task.task_id}
              userId={user?.user_id ?? 0}
              floorNumber={task.rooms?.floor_number}
              roomNumber={task.rooms?.room_number}
              maxPhotos={3}
              required={photoRequired}
              onPhotosChange={setUploadedPhotoUrls}
            />
          </View>
        )}

        {/* ACTION BUTTONS */}
        {taskStatus === 'PENDING' && (
          <TouchableOpacity style={[S.btn, S.btnStart]} onPress={handleStart} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>▶ Start Cleaning</Text>}
          </TouchableOpacity>
        )}

        {taskStatus === 'IN_PROGRESS' && accessStatus === 'ACCESSIBLE' && (
          <TouchableOpacity
            style={[S.btn, canComplete ? S.btnComplete : S.btnDisabled]}
            onPress={handleComplete}
            disabled={loading || !canComplete}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={S.btnText}>
                {!allChecked
                  ? `✅ Mark as Cleaned (${completedCount}/${checklist.length} done)`
                  : !photoSatisfied ? '📷 1 photo required to complete'
                  : '✅ Mark as Cleaned'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {taskStatus === 'IN_PROGRESS' && (
          <TouchableOpacity style={[S.btn, S.btnHelp]} onPress={handleRequestHelp}>
            <Text style={S.btnText}>📞 Request Help from Supervisor</Text>
          </TouchableOpacity>
        )}

        {(taskStatus === 'PENDING' || taskStatus === 'IN_PROGRESS') && (
          <TouchableOpacity style={[S.btn, S.btnSkip]} onPress={handleSkip}>
            <Text style={S.btnText}>Skip Room</Text>
          </TouchableOpacity>
        )}

        {/* MAINTENANCE SECTION */}
        <View style={S.maintenanceDivider}>
          <View style={S.dividerLine} />
          <Text style={S.dividerLabel}>MAINTENANCE</Text>
          <View style={S.dividerLine} />
        </View>

        {/* Report Issue button — full featured screen */}
        <TouchableOpacity
          style={[S.btn, S.btnMaintenance]}
          onPress={() => navigation.navigate('ReportIssue', {
            task_id:     task.task_id,
            room_id:     task.room_id,
            room_number: roomLabel,
          })}
        >
          <View style={S.btnInner}>
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={S.btnText}>Report Maintenance Issue</Text>
          </View>
        </TouchableOpacity>

        {/* View issue history for this room */}
        <TouchableOpacity
          style={[S.btn, S.btnHistory]}
          onPress={() => navigation.navigate('RoomIssueHistory', {
            room_id:     task.room_id,
            room_number: roomLabel,
          })}
        >
          <View style={S.btnInner}>
            <Ionicons name="time-outline" size={18} color="#94a3b8" />
            <Text style={[S.btnText, { color: '#94a3b8' }]}>View Room Issue History</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.detailRow}>
      <Text style={S.detailLabel}>{label}</Text>
      <Text style={S.detailValue}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#0f172a' },
  container:          { flex: 1, backgroundColor: '#0f172a' },
  loadingWrap:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:        { color: '#64748b', fontSize: 14 },
  header:             { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn:            { padding: 4 },
  backText:           { color: '#0ea5e9', fontSize: 16 },
  headerTitle:        { flex: 1, fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  statusBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText:         { fontSize: 12, fontWeight: '600' },
  timerBanner:        { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12,
                        backgroundColor: '#0ea5e911', borderWidth: 1, borderColor: '#0ea5e9',
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerBannerOver:    { backgroundColor: '#ef444411', borderColor: '#ef4444' },
  timerSubLabel:      { fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: '600', letterSpacing: 0.5 },
  timerValue:         { fontSize: 36, fontWeight: '800', color: '#0ea5e9', fontVariant: ['tabular-nums'] },
  timerValueOver:     { color: '#ef4444' },
  timerRight:         { alignItems: 'flex-end' },
  timerBudgetLabel:   { fontSize: 11, color: '#64748b', marginBottom: 2 },
  timerBudgetValue:   { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  timerProgressTrack: { marginHorizontal: 16, marginTop: 6, height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  timerProgressFill:  { height: '100%', borderRadius: 2 },
  card:               { margin: 16, marginBottom: 0, padding: 16, backgroundColor: '#1e293b', borderRadius: 12 },
  cardTitle:          { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
  rowBetween:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editLink:           { color: '#0ea5e9', fontSize: 13 },
  labelBadge:         { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
  labelTitle:         { fontSize: 15, fontWeight: '700' },
  labelDesc:          { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  labelGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  labelOption:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  labelOptionText:    { fontSize: 13, color: '#94a3b8' },
  detailRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#0f172a44' },
  detailLabel:        { fontSize: 14, color: '#64748b' },
  detailValue:        { fontSize: 14, color: '#cbd5e1', fontWeight: '500', flexShrink: 1, textAlign: 'right', maxWidth: '65%' },
  accessGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accessBtn:          { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', alignItems: 'center', minWidth: '45%' },
  accessEmoji:        { fontSize: 18, marginBottom: 4 },
  accessBtnText:      { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  dndWarning:         { marginTop: 10, padding: 10, backgroundColor: '#ef444422', borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' },
  dndWarningText:     { color: '#fca5a5', fontSize: 13 },
  progressLabel:      { fontSize: 16, fontWeight: '700', color: '#0ea5e9' },
  progressBar:        { height: 6, backgroundColor: '#0f172a', borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  progressFill:       { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },
  checkCategory:      { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  checkItem:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f172a33' },
  checkbox:           { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#334155', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxDone:       { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkmark:          { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel:         { fontSize: 14, color: '#cbd5e1', flex: 1 },
  checkLabelDone:     { color: '#475569', textDecorationLine: 'line-through' },
  notesInput:         { marginTop: 12, backgroundColor: '#0f172a', color: '#f1f5f9', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  btn:                { marginHorizontal: 16, marginTop: 10, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnInner:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnStart:           { backgroundColor: '#0ea5e9' },
  btnComplete:        { backgroundColor: '#22c55e' },
  btnDisabled:        { backgroundColor: '#334155' },
  btnHelp:            { backgroundColor: '#f59e0b' },
  btnSkip:            { backgroundColor: '#475569' },
  btnMaintenance:     { backgroundColor: '#dc2626' },
  btnHistory:         { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnText:            { color: '#fff', fontSize: 15, fontWeight: '700' },
  maintenanceDivider: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 24, marginBottom: 4, gap: 10 },
  dividerLine:        { flex: 1, height: 1, backgroundColor: '#334155' },
  dividerLabel:       { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 1 },
});
