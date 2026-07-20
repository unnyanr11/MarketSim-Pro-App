import { useEffect, useRef, useState } from 'react';

/**
 * Persistent countdown timer.
 *
 * Works across screen re-opens and app restarts because elapsed time is
 * derived from `started_at` (a real DB timestamp) — not from an in-memory
 * counter that resets on unmount.
 *
 * Usage:
 *   const { elapsedSeconds, timerLabel, isOvertime } = useTaskTimer({
 *     startedAt: task.started_at,
 *     budgetMinutes: task.estimated_minutes ?? 30,
 *     running: task.status === 'IN_PROGRESS',
 *   });
 */

interface Options {
  /** ISO timestamp written to DB when task was started. Source of truth. */
  startedAt: string | null | undefined;
  /** Estimated cleaning budget in minutes (default 30). */
  budgetMinutes?: number;
  /** Whether the timer should tick. Pass false when task is CLEANED/SKIPPED. */
  running: boolean;
}

interface Result {
  elapsedSeconds: number;
  budgetSeconds: number;
  remaining: number;       // negative when overtime
  isOvertime: boolean;
  timerLabel: string;      // "MM:SS" or "-MM:SS" when overtime
  progressRatio: number;   // 0 → 1, capped at 1
}

function fmt(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const m   = Math.floor(abs / 60).toString().padStart(2, '0');
  const s   = (abs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function calcElapsed(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, diff);
}

export function useTaskTimer({
  startedAt,
  budgetMinutes = 30,
  running,
}: Options): Result {
  // Seed directly from the DB timestamp so it survives unmount/remount.
  const [elapsedSeconds, setElapsedSeconds] = useState(() => calcElapsed(startedAt));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-seed whenever startedAt changes (e.g. after live re-fetch on mount).
  useEffect(() => {
    setElapsedSeconds(calcElapsed(startedAt));
  }, [startedAt]);

  // Tick every second when running.
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Resync to wall clock on each mount so drift never accumulates.
    setElapsedSeconds(calcElapsed(startedAt));
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(calcElapsed(startedAt));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, startedAt]);

  const budgetSeconds  = budgetMinutes * 60;
  const remaining      = budgetSeconds - elapsedSeconds;
  const isOvertime     = remaining < 0;
  const timerLabel     = isOvertime ? `-${fmt(elapsedSeconds - budgetSeconds)}` : fmt(remaining);
  const progressRatio  = Math.min(1, elapsedSeconds / budgetSeconds);

  return { elapsedSeconds, budgetSeconds, remaining, isOvertime, timerLabel, progressRatio };
}
