import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { log } from '../lib/logger';
import type { HousekeepingTask } from '../types';

/**
 * Fires a local notification when any task's due_time has passed and it's still PENDING or IN_PROGRESS.
 * Call this hook inside TaskListScreen or HomeScreen with the current task list.
 */
export function useOverdueAlert(tasks: HousekeepingTask[] | { task_id: number; status: string; due_time: string | null; rooms?: { room_number?: string } }[]) {
  const alertedIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    const now = Date.now();
    tasks.forEach(task => {
      if (!task.due_time) return;
      if (task.status === 'CLEANED') return;
      if (alertedIds.current.has(task.task_id)) return;

      const dueMs = new Date(task.due_time).getTime();
      if (now > dueMs) {
        alertedIds.current.add(task.task_id);
        const roomNum = (task as any).rooms?.room_number ?? task.task_id;
        log('Overdue alert for task', task.task_id);
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Overdue Task',
            body: `Room ${roomNum} is past its due time and still ${task.status.replace('_', ' ').toLowerCase()}.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // fire immediately
        }).catch(() => {});
      }
    });
  }, [tasks]);
}
