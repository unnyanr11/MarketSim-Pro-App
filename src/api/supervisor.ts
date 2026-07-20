// Fix: import from correct relative path (./client, not ../lib/client)
import { supabase } from './client';
import type { User, HousekeepingTask, HelpRequest } from '../types';

const logError = (fn: string, err: unknown) => console.error(`[${fn}]`, err);

/** Fetch all active housekeeping staff */
export async function getActiveStaff(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'HOUSEKEEPING')
    .eq('is_active', true)
    .order('full_name');
  if (error) { logError('getActiveStaff', error); return []; }
  return (data ?? []) as User[];
}

/** Reassign a task to a different staff member and reset its state */
export async function reassignTask(
  taskId: number,
  newUserId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({
      assigned_to: newUserId,
      status: 'PENDING',
      started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('task_id', taskId);
  if (error) { logError('reassignTask', error); return false; }
  return true;
}

/** Get all non-cleaned tasks with staff info (manager/supervisor view) */
export async function getAllTasksWithStaff(): Promise<
  (HousekeepingTask & { assigned_user?: { full_name: string; username: string } })[]
> {
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    // Use consistent FK hint: users table, assigned_to FK
    .select('*, rooms(*), assigned_user:users!housekeeping_tasks_assigned_to_fkey(full_name, username)')
    .neq('status', 'CLEANED')
    .order('priority', { ascending: false });
  if (error) { logError('getAllTasksWithStaff', error); return []; }
  return (data ?? []) as any[];
}

/** Get floor-specific tasks for a supervisor */
export async function getFloorTasks(floorNumber: number): Promise<HousekeepingTask[]> {
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms!inner(room_number, floor_number, room_type), assigned_user:users!housekeeping_tasks_assigned_to_fkey(full_name, username)')
    .eq('rooms.floor_number', floorNumber)
    .order('priority', { ascending: false });
  if (error) { logError('getFloorTasks', error); return []; }
  return (data ?? []) as HousekeepingTask[];
}

/** Get all pending help requests with task + room info for supervisors */
export async function getHelpRequests(): Promise<HelpRequest[]> {
  const { data, error } = await supabase
    .from('help_requests')
    .select('*, housekeeping_tasks(room_id, rooms(room_number, floor_number)), requested_user:users!help_requests_requested_by_fkey(full_name)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });
  if (error) { logError('getHelpRequests', error); return []; }
  return (data ?? []) as HelpRequest[];
}

/** Acknowledge a help request */
export async function acknowledgeHelpRequest(requestId: number): Promise<boolean> {
  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'ACKNOWLEDGED' })
    .eq('request_id', requestId);
  if (error) { logError('acknowledgeHelpRequest', error); return false; }
  return true;
}
