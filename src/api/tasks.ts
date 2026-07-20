import { supabase } from './client';
import type {
  HousekeepingTask,
  ChecklistItem,
  AccessStatus,
  MaintenanceIssueType,
  MaintenanceIssue,
  RoomPriorityLabel,
  ShiftSummary,
} from '../types';

// ─── FETCH ────────────────────────────────────────────────────────────────────

export async function getMyTasks(userId: number): Promise<HousekeepingTask[]> {
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(room_number, floor_number, room_type)')
    .eq('assigned_to', userId)
    .order('priority', { ascending: false })
    .order('due_time', { ascending: true, nullsFirst: false });
  if (error) { console.error('[getMyTasks]', error.message); return []; }
  return (data ?? []) as HousekeepingTask[];
}

export async function getAllTasksForManager(): Promise<HousekeepingTask[]> {
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(room_number, floor_number, room_type), staff:users!housekeeping_tasks_assigned_to_fkey(full_name, username)')
    .order('priority', { ascending: false });
  if (error) { console.error('[getAllTasksForManager]', error.message); return []; }
  return (data ?? []) as HousekeepingTask[];
}

/**
 * Returns all tasks for a specific floor number.
 * Joins via rooms table — fetches all tasks, then filters client-side
 * to avoid PostgREST joined-column filter quirks.
 */
export async function getFloorTasks(floorNumber: number): Promise<HousekeepingTask[]> {
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(room_number, floor_number, room_type), staff:users!housekeeping_tasks_assigned_to_fkey(full_name, username)')
    .order('priority', { ascending: false });
  if (error) { console.error('[getFloorTasks]', error.message); return []; }
  return ((data ?? []) as HousekeepingTask[]).filter(
    t => (t.rooms as any)?.floor_number === floorNumber
  );
}

/**
 * Fetches a single task by ID with full room join.
 */
export async function getTaskById(taskId: number): Promise<HousekeepingTask | null> {
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(room_number, floor_number, room_type), staff:users!housekeeping_tasks_assigned_to_fkey(full_name, username)')
    .eq('task_id', taskId)
    .single();
  if (error) { console.error('[getTaskById]', error.message); return null; }
  return data as HousekeepingTask;
}

export async function getOptimizedRoute(userId: number): Promise<HousekeepingTask[]> {
  const tasks = await getMyTasks(userId);
  const labelOrder: Record<string, number> = {
    CHECKOUT: 0, EARLY_CHECKIN: 1, VIP_GUEST: 2, STAYIN: 3, STANDARD: 4,
  };
  return tasks
    .filter(t => t.status !== 'CLEANED' && t.status !== 'SKIPPED')
    .sort((a, b) => {
      const la = labelOrder[a.priority_label ?? 'STANDARD'] ?? 4;
      const lb = labelOrder[b.priority_label ?? 'STANDARD'] ?? 4;
      if (la !== lb) return la - lb;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (a.rooms?.room_number ?? '').localeCompare(b.rooms?.room_number ?? '');
    });
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export async function startTask(taskId: number, userId: number): Promise<boolean> {
  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
    .eq('task_id', taskId)
    .eq('assigned_to', userId);
  return !error;
}

export async function completeTaskWithChecklist(
  taskId: number,
  userId: number,
  checklist: ChecklistItem[],
  notes?: string,
  photoUrls?: string[],
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: taskRow } = await supabase
    .from('housekeeping_tasks')
    .select('room_id, started_at')
    .eq('task_id', taskId)
    .single();

  const actualMinutes = taskRow?.started_at
    ? Math.round((Date.now() - new Date(taskRow.started_at).getTime()) / 60000)
    : null;

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({
      status: 'CLEANED',
      completed_at: now,
      checklist_data: checklist,
      completion_notes: notes ?? null,
      photos: photoUrls ?? [],
      actual_minutes: actualMinutes,
    })
    .eq('task_id', taskId)
    .eq('assigned_to', userId);

  if (!error && taskRow?.room_id) {
    await supabase
      .from('rooms')
      .update({
        clean_status: 'CLEAN',
        last_cleaned_at: now,
        last_cleaned_by: userId,
      })
      .eq('room_id', taskRow.room_id);
  }
  return !error;
}

export async function updateTaskAccessStatus(
  taskId: number,
  userId: number,
  status: AccessStatus,
): Promise<boolean> {
  const updates: Record<string, unknown> = { access_status: status };
  if (status !== 'ACCESSIBLE') updates.status = 'DELAYED';
  const { error } = await supabase
    .from('housekeeping_tasks')
    .update(updates)
    .eq('task_id', taskId);
  return !error;
}

export async function skipTask(
  taskId: number,
  userId: number,
  reason: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'SKIPPED', completion_notes: reason })
    .eq('task_id', taskId)
    .eq('assigned_to', userId);
  return !error;
}

export async function updatePriorityLabel(
  taskId: number,
  label: RoomPriorityLabel,
): Promise<boolean> {
  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ priority_label: label })
    .eq('task_id', taskId);
  return !error;
}

// ─── REASSIGN (MANAGER) ───────────────────────────────────────────────────────

/**
 * Reassigns a single task to a new staff member.
 * Calls the `reassign_single_task` RPC which:
 *   - Validates manager role
 *   - Validates target staff is HOUSEKEEPING
 *   - Resets IN_PROGRESS → PENDING if the task was already started
 *   - Supports cross-floor reassignment
 * Returns { success, error?, newStaffName? }
 */
export async function reassignTask(
  taskId: number,
  newStaffId: number,
  managerId: number,
): Promise<{ success: boolean; error?: string; newStaffName?: string }> {
  try {
    const { data, error } = await supabase.rpc('reassign_single_task', {
      p_task_id:      taskId,
      p_new_staff_id: newStaffId,
      p_manager_id:   managerId,
    });

    if (error) {
      console.error('[reassignTask] RPC error:', error.message);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; new_staff_name?: string };
    if (!result?.success) {
      return { success: false, error: result?.error ?? 'Reassignment failed' };
    }

    return { success: true, newStaffName: result.new_staff_name };
  } catch (e: any) {
    console.error('[reassignTask] exception:', e?.message ?? e);
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}

// ─── PHOTO UPLOAD ─────────────────────────────────────────────────────────────

export async function uploadTaskPhoto(
  taskId: number,
  userId: number,
  uri: string,
  index: number,
  floorNumber?: number,
  roomNumber?: string,
): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
    const mimeType = safeExt === 'png'  ? 'image/png'
                   : safeExt === 'webp' ? 'image/webp'
                   : safeExt === 'heic' ? 'image/heic'
                   : 'image/jpeg';

    const floorSegment = floorNumber != null ? `floor-${floorNumber}` : 'floor-unknown';
    const roomSegment  = roomNumber  ? `room-${roomNumber}` : 'room-unknown';
    const path = `${floorSegment}/${roomSegment}/task-${taskId}/${userId}_${index}_${Date.now()}.${safeExt}`;

    const formData = new FormData();
    formData.append('file', { uri, type: mimeType, name: `photo.${safeExt}` } as any);

    const { error } = await supabase.storage
      .from('room-photos')
      .upload(path, formData, { contentType: mimeType, upsert: true });

    if (error) { console.error('[uploadTaskPhoto]', error.message); return null; }

    const { data } = supabase.storage.from('room-photos').getPublicUrl(path);
    return data.publicUrl;
  } catch (e: any) {
    console.error('[uploadTaskPhoto] exception:', e?.message ?? e);
    return null;
  }
}

// ─── MAINTENANCE ──────────────────────────────────────────────────────────────

export async function reportMaintenanceIssue(
  roomId: number,
  reportedBy: number,
  issueType: MaintenanceIssueType,
  description: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  linkedTaskId?: number,
  photoUrl?: string,
): Promise<MaintenanceIssue | null> {
  const { data, error } = await supabase
    .from('maintenance_issues')
    .insert({
      room_id: roomId,
      reported_by: reportedBy,
      issue_type: issueType,
      description,
      severity,
      status: 'OPEN',
      linked_task_id: linkedTaskId ?? null,
      photo_url: photoUrl ?? null,
    })
    .select()
    .single();
  if (error) { console.error('[reportMaintenanceIssue]', error.message); return null; }
  return data as MaintenanceIssue;
}

// ─── HELP REQUESTS ───────────────────────────────────────────────────────────

export async function requestHelp(
  taskId: number,
  staffId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('help_requests')
    .insert({
      task_id: taskId,
      requested_by: staffId,
      status: 'PENDING',
    });
  if (error) { console.error('[requestHelp]', error.message); return false; }
  return true;
}

// ─── SHIFT SUMMARY ────────────────────────────────────────────────────────────

export async function getShiftSummary(
  userId: number,
  date?: string,
): Promise<ShiftSummary> {
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('housekeeping_tasks')
    .select('*')
    .eq('assigned_to', userId)
    .gte('created_at', `${targetDate}T00:00:00.000Z`)
    .lte('created_at', `${targetDate}T23:59:59.999Z`);

  const tasks = (data ?? []) as HousekeepingTask[];
  const completed = tasks.filter(t => t.status === 'CLEANED');
  const delayed   = tasks.filter(t => t.status === 'DELAYED');
  const skipped   = tasks.filter(t => t.status === 'SKIPPED');
  const dnd_count = tasks.filter(t => t.access_status !== 'ACCESSIBLE').length;
  const overdue   = tasks.filter(t =>
    t.status !== 'CLEANED' && t.due_time && new Date(t.due_time) < new Date()
  );

  const withTime = completed.filter(t => t.started_at && t.completed_at);
  const total_minutes = withTime.reduce((sum, t) => {
    return sum + (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000;
  }, 0);
  const avg_minutes = withTime.length > 0 ? Math.round(total_minutes / withTime.length) : null;

  const onTime = completed.filter(t =>
    !t.due_time || new Date(t.completed_at!) <= new Date(t.due_time)
  );
  const on_time_rate = completed.length > 0
    ? Math.round((onTime.length / completed.length) * 100)
    : 100;

  return {
    total_assigned: tasks.length,
    completed: completed.length,
    pending: tasks.filter(t => t.status === 'PENDING').length,
    in_progress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    delayed: delayed.length,
    skipped: skipped.length,
    dnd_count,
    avg_minutes,
    total_minutes: Math.round(total_minutes),
    on_time_rate,
    overdue_tasks: overdue,
  };
}
