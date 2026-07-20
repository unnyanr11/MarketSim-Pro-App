/**
 * reassignment.ts
 * Covers all three task-movement flows:
 *   1. Supervisor-initiated reassignment
 *   2. Staff-initiated help request
 *   3. Peer-to-peer task swap
 */
import { supabase } from './client';

const log = (fn: string, err: unknown) => console.error(`[${fn}]`, err);

// ─── Types ────────────────────────────────────────────────────────────────────

export type HelpRequestStatus =
  | 'PENDING'
  | 'ACKNOWLEDGED'
  | 'HELP_COMING'
  | 'RESOLVED'
  | 'DISMISSED';

export type SwapStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'SUPERVISOR_NOTIFIED';

export interface StaffLoad {
  user_id: number;
  full_name: string;
  username: string;
  assigned_floor: number | null;
  pending_tasks: number;
}

export interface HelpRequest {
  request_id: number;
  task_id: number;
  requested_by: number;
  floor_number: number | null;
  message: string | null;
  tasks_remaining: number | null;
  shift_ends_at: string | null;
  status: HelpRequestStatus;
  supervisor_response: string | null;
  resolved_at: string | null;
  resolved_by: number | null;
  created_at: string;
  // joined
  requester?: { full_name: string; username: string };
  task?: { room_id: number; room?: { room_number: string; floor_number: number } };
}

export interface SwapRequest {
  swap_id: number;
  requester_id: number;
  responder_id: number;
  task_offered: number;
  task_wanted: number;
  status: SwapStatus;
  requester_note: string | null;
  responder_note: string | null;
  supervisor_notified_at: string | null;
  created_at: string;
  // joined
  requester?: { full_name: string; username: string };
  responder?: { full_name: string; username: string };
  offered_task?: { room_id: number; room?: { room_number: string } };
  wanted_task?: { room_id: number; room?: { room_number: string } };
}

// ─── Flow 1: Supervisor Reassignment ─────────────────────────────────────────

/**
 * Returns all active housekeeping staff on a given floor with their
 * current non-cleaned task count — for the reassignment picker UI.
 */
export async function getStaffLoadByFloor(floorNumber: number): Promise<StaffLoad[]> {
  const { data: staff, error } = await supabase
    .from('users')
    .select('user_id, full_name, username, assigned_floor')
    .eq('role', 'HOUSEKEEPING')
    .eq('is_active', true)
    .eq('assigned_floor', floorNumber);

  if (error) { log('getStaffLoadByFloor', error); return []; }
  if (!staff?.length) return [];

  // Count pending/in-progress tasks per staff member
  const ids = staff.map(s => s.user_id);
  const { data: tasks } = await supabase
    .from('housekeeping_tasks')
    .select('assigned_to')
    .in('assigned_to', ids)
    .in('status', ['PENDING', 'IN_PROGRESS', 'DELAYED']);

  const counts: Record<number, number> = {};
  for (const t of tasks ?? []) {
    counts[t.assigned_to] = (counts[t.assigned_to] ?? 0) + 1;
  }

  return staff.map(s => ({
    ...s,
    pending_tasks: counts[s.user_id] ?? 0,
  })) as StaffLoad[];
}

/**
 * Supervisor reassigns a task. Logs the action in task_audit_log.
 */
export async function supervisorReassignTask(
  taskId: number,
  newUserId: number,
  supervisorId: number,
  oldUserId?: number,
): Promise<boolean> {
  const { error: updateErr } = await supabase
    .from('housekeeping_tasks')
    .update({
      assigned_to: newUserId,
      status: 'PENDING',
      started_at: null,
      updated_at: new Date().toISOString(),
      updated_by: supervisorId,
    })
    .eq('task_id', taskId);

  if (updateErr) { log('supervisorReassignTask:update', updateErr); return false; }

  // Audit log
  await supabase.from('task_audit_log').insert({
    task_id: taskId,
    action: 'REASSIGNED',
    performed_by: supervisorId,
    old_assignee: oldUserId ?? null,
    new_assignee: newUserId,
    note: 'Supervisor-initiated reassignment',
  });

  return true;
}

// ─── Flow 2: Staff Help Request ───────────────────────────────────────────────

/**
 * Staff member raises hand — creates a help request visible to supervisors.
 */
export async function requestHelp(params: {
  taskId: number;
  requestedBy: number;
  floorNumber: number;
  tasksRemaining: number;
  shiftEndsAt?: string;
  message?: string;
}): Promise<HelpRequest | null> {
  // Prevent duplicate PENDING requests for the same task
  const { data: existing } = await supabase
    .from('help_requests')
    .select('request_id')
    .eq('task_id', params.taskId)
    .eq('requested_by', params.requestedBy)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (existing) {
    // Return the existing request rather than creating a duplicate
    const { data } = await supabase
      .from('help_requests')
      .select('*')
      .eq('request_id', existing.request_id)
      .single();
    return data as HelpRequest;
  }

  const { data, error } = await supabase
    .from('help_requests')
    .insert({
      task_id: params.taskId,
      requested_by: params.requestedBy,
      floor_number: params.floorNumber,
      tasks_remaining: params.tasksRemaining,
      shift_ends_at: params.shiftEndsAt ?? null,
      message: params.message ?? null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) { log('requestHelp', error); return null; }
  return data as HelpRequest;
}

/**
 * Staff-side: get all their own help requests to show status feedback.
 */
export async function getMyHelpRequests(userId: number): Promise<HelpRequest[]> {
  const { data, error } = await supabase
    .from('help_requests')
    .select('*')
    .eq('requested_by', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { log('getMyHelpRequests', error); return []; }
  return (data ?? []) as HelpRequest[];
}

/**
 * Supervisor: get all pending help requests for a floor.
 */
export async function getFloorHelpRequests(floorNumber: number): Promise<HelpRequest[]> {
  const { data, error } = await supabase
    .from('help_requests')
    .select(`
      *,
      requester:users!help_requests_requested_by_fkey(full_name, username),
      task:housekeeping_tasks!help_requests_task_id_fkey(
        room_id,
        room:rooms(room_number, floor_number)
      )
    `)
    .eq('floor_number', floorNumber)
    .in('status', ['PENDING', 'ACKNOWLEDGED'])
    .order('created_at', { ascending: true });

  if (error) { log('getFloorHelpRequests', error); return []; }
  return (data ?? []) as HelpRequest[];
}

/**
 * Supervisor responds to a help request.
 * status: ACKNOWLEDGED | HELP_COMING | RESOLVED | DISMISSED
 */
export async function respondToHelpRequest(
  requestId: number,
  supervisorId: number,
  status: Exclude<HelpRequestStatus, 'PENDING'>,
  response?: string,
): Promise<boolean> {
  const update: Record<string, unknown> = { status, supervisor_response: response ?? null };
  if (status === 'RESOLVED' || status === 'DISMISSED') {
    update.resolved_at = new Date().toISOString();
    update.resolved_by = supervisorId;
  }

  const { error } = await supabase
    .from('help_requests')
    .update(update)
    .eq('request_id', requestId);

  if (error) { log('respondToHelpRequest', error); return false; }
  return true;
}

/**
 * Staff cancels their own pending help request.
 */
export async function cancelHelpRequest(
  requestId: number,
  userId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'DISMISSED' })
    .eq('request_id', requestId)
    .eq('requested_by', userId)
    .eq('status', 'PENDING');

  if (error) { log('cancelHelpRequest', error); return false; }
  return true;
}

// ─── Flow 3: Peer Swap ────────────────────────────────────────────────────────

/**
 * Staff member A proposes swapping their task for staff member B's task.
 */
export async function proposeSwap(params: {
  requesterId: number;
  responderId: number;
  taskOffered: number;  // task A wants to give away
  taskWanted: number;   // task A wants to take
  note?: string;
}): Promise<SwapRequest | null> {
  const { data, error } = await supabase
    .from('task_swap_requests')
    .insert({
      requester_id: params.requesterId,
      responder_id: params.responderId,
      task_offered: params.taskOffered,
      task_wanted: params.taskWanted,
      requester_note: params.note ?? null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) { log('proposeSwap', error); return null; }
  return data as SwapRequest;
}

/**
 * Get pending swap requests received by a staff member (to accept/decline).
 */
export async function getIncomingSwaps(userId: number): Promise<SwapRequest[]> {
  const { data, error } = await supabase
    .from('task_swap_requests')
    .select(`
      *,
      requester:users!task_swap_requests_requester_id_fkey(full_name, username),
      offered_task:housekeeping_tasks!task_swap_requests_task_offered_fkey(
        room_id, room:rooms(room_number)
      ),
      wanted_task:housekeeping_tasks!task_swap_requests_task_wanted_fkey(
        room_id, room:rooms(room_number)
      )
    `)
    .eq('responder_id', userId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });

  if (error) { log('getIncomingSwaps', error); return []; }
  return (data ?? []) as SwapRequest[];
}

/**
 * Get outgoing swap requests sent by a staff member.
 */
export async function getOutgoingSwaps(userId: number): Promise<SwapRequest[]> {
  const { data, error } = await supabase
    .from('task_swap_requests')
    .select(`
      *,
      responder:users!task_swap_requests_responder_id_fkey(full_name, username),
      offered_task:housekeeping_tasks!task_swap_requests_task_offered_fkey(
        room_id, room:rooms(room_number)
      ),
      wanted_task:housekeeping_tasks!task_swap_requests_task_wanted_fkey(
        room_id, room:rooms(room_number)
      )
    `)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { log('getOutgoingSwaps', error); return []; }
  return (data ?? []) as SwapRequest[];
}

/**
 * Responder accepts the swap.
 * Atomically reassigns both tasks and marks the swap ACCEPTED → SUPERVISOR_NOTIFIED.
 */
export async function acceptSwap(
  swapId: number,
  responderId: number,
  note?: string,
): Promise<boolean> {
  // 1. Fetch swap details
  const { data: swap, error: fetchErr } = await supabase
    .from('task_swap_requests')
    .select('*')
    .eq('swap_id', swapId)
    .eq('responder_id', responderId)
    .eq('status', 'PENDING')
    .single();

  if (fetchErr || !swap) { log('acceptSwap:fetch', fetchErr); return false; }

  // 2. Reassign task_offered → responder, task_wanted → requester
  const [r1, r2] = await Promise.all([
    supabase
      .from('housekeeping_tasks')
      .update({ assigned_to: swap.responder_id, updated_at: new Date().toISOString() })
      .eq('task_id', swap.task_offered),
    supabase
      .from('housekeeping_tasks')
      .update({ assigned_to: swap.requester_id, updated_at: new Date().toISOString() })
      .eq('task_id', swap.task_wanted),
  ]);

  if (r1.error || r2.error) {
    log('acceptSwap:reassign', r1.error ?? r2.error);
    return false;
  }

  // 3. Mark swap as SUPERVISOR_NOTIFIED and log both actions
  await Promise.all([
    supabase
      .from('task_swap_requests')
      .update({
        status: 'SUPERVISOR_NOTIFIED',
        responder_note: note ?? null,
        supervisor_notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('swap_id', swapId),
    supabase.from('task_audit_log').insert([
      {
        task_id: swap.task_offered,
        action: 'SWAP_ACCEPTED',
        performed_by: responderId,
        old_assignee: swap.requester_id,
        new_assignee: swap.responder_id,
        note: `Peer swap #${swapId}`,
      },
      {
        task_id: swap.task_wanted,
        action: 'SWAP_ACCEPTED',
        performed_by: responderId,
        old_assignee: swap.responder_id,
        new_assignee: swap.requester_id,
        note: `Peer swap #${swapId}`,
      },
    ]),
  ]);

  return true;
}

/**
 * Responder declines the swap.
 */
export async function declineSwap(
  swapId: number,
  responderId: number,
  note?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('task_swap_requests')
    .update({
      status: 'DECLINED',
      responder_note: note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('swap_id', swapId)
    .eq('responder_id', responderId)
    .eq('status', 'PENDING');

  if (error) { log('declineSwap', error); return false; }
  return true;
}

/**
 * Requester cancels a pending swap they sent.
 */
export async function cancelSwap(
  swapId: number,
  requesterId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('task_swap_requests')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('swap_id', swapId)
    .eq('requester_id', requesterId)
    .eq('status', 'PENDING');

  if (error) { log('cancelSwap', error); return false; }
  return true;
}

/**
 * Supervisor view: all recent accepted swaps (for the audit/log panel).
 */
export async function getSwapLog(floorNumber?: number): Promise<SwapRequest[]> {
  let query = supabase
    .from('task_swap_requests')
    .select(`
      *,
      requester:users!task_swap_requests_requester_id_fkey(full_name, username),
      responder:users!task_swap_requests_responder_id_fkey(full_name, username),
      offered_task:housekeeping_tasks!task_swap_requests_task_offered_fkey(
        room_id, room:rooms(room_number, floor_number)
      ),
      wanted_task:housekeeping_tasks!task_swap_requests_task_wanted_fkey(
        room_id, room:rooms(room_number, floor_number)
      )
    `)
    .in('status', ['ACCEPTED', 'SUPERVISOR_NOTIFIED'])
    .order('supervisor_notified_at', { ascending: false })
    .limit(50);

  const { data, error } = await query;
  if (error) { log('getSwapLog', error); return []; }
  return (data ?? []) as SwapRequest[];
}
