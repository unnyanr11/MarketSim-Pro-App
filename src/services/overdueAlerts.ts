/**
 * overdueAlerts.ts
 *
 * Polls every 5 minutes for tasks whose due_time has passed while still
 * PENDING or IN_PROGRESS, then fires a local push notification.
 *
 * Usage:
 *   startOverdueAlerts(userId)   — call when HomeScreen mounts
 *   stopOverdueAlerts()          — call when HomeScreen unmounts
 */
import { supabase }              from '../api/client';
import { showInstantNotification } from './notifications';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;
/** Track which task_ids we've already alerted for this session so we don't spam */
const alerted = new Set<number>();

export function startOverdueAlerts(userId: number): void {
  if (intervalId) return; // already running
  const check = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('housekeeping_tasks')
        .select('task_id, due_time, rooms(room_number)')
        .eq('assigned_to', userId)
        .in('status', ['PENDING', 'IN_PROGRESS'])
        .lt('due_time', now)
        .not('due_time', 'is', null);

      if (error || !data) return;

      for (const task of data as any[]) {
        if (alerted.has(task.task_id)) continue;
        alerted.add(task.task_id);

        const roomNo = task.rooms?.room_number ?? `#${task.task_id}`;
        await showInstantNotification({
          title: '⏰ Overdue Task',
          body:  `Room ${roomNo} is overdue! Please complete or flag it for your supervisor.`,
          data:  { type: 'overdue', task_id: task.task_id },
        });
      }
    } catch (_) {}
  };

  // Run once immediately, then on interval
  check();
  intervalId = setInterval(check, POLL_INTERVAL_MS);
}

export function stopOverdueAlerts(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  alerted.clear();
}
