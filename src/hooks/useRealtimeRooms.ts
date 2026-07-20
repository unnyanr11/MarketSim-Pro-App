import { useEffect, useRef } from 'react';
import { supabase } from '../lib/client';
import { log } from '../lib/logger';

type ChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

/**
 * Subscribe to realtime room + task changes.
 * Uses a unique channel name per user to avoid duplicate subscriptions.
 */
export function useRealtimeRooms(
  userId: number | undefined,
  onRoomChange: (payload: ChangePayload) => void,
  onTaskChange: (payload: ChangePayload) => void
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channelName = `hms-changes-user-${userId}`;
    log('Subscribing to realtime channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        log('Room change:', payload.eventType);
        onRoomChange(payload as unknown as ChangePayload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks' }, (payload) => {
        log('Task change:', payload.eventType);
        onTaskChange(payload as unknown as ChangePayload);
      })
      .subscribe((status) => {
        log('Realtime status:', status);
      });

    channelRef.current = channel;

    return () => {
      log('Unsubscribing realtime channel:', channelName);
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
