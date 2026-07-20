/**
 * Messages.tsx — Conversations list
 * Supports recipientId param (from UserProfile → Message button)
 * to auto-open or create a thread with that user.
 * DB tables: message_threads, messages (lowercase, matching web)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Messages'>;

interface Thread {
  id: string;
  other_user_name: string;
  other_user_id: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export default function Messages({ route, navigation }: Props) {
  const recipientId = route.params?.recipientId;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await fetchThreads(user.id);

      // If recipientId param given (from UserProfile), open/create thread
      if (recipientId && recipientId !== user.id) {
        await openOrCreateThread(user.id, recipientId);
      }
    })();
  }, []);

  const fetchThreads = async (uid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('message_threads')
        .select('*, other_user:other_user_id(display_name)')
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
        .order('last_message_at', { ascending: false });
      setThreads((data as any[])?.map(t => ({
        id: t.id,
        other_user_id: t.user1_id === uid ? t.user2_id : t.user1_id,
        other_user_name: t.other_user?.display_name ?? 'Unknown',
        last_message: t.last_message ?? '',
        last_message_at: t.last_message_at ?? '',
        unread_count: t.unread_count ?? 0,
      })) ?? []);
    } finally {
      setLoading(false);
    }
  };

  const openOrCreateThread = async (uid: string, otherId: string) => {
    // Check for existing thread
    const { data: existing } = await supabase
      .from('message_threads')
      .select('id, other_user:other_user_id(display_name)')
      .or(`and(user1_id.eq.${uid},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${uid})`)
      .maybeSingle();

    if (existing) {
      const otherName = (existing as any).other_user?.display_name ?? 'User';
      navigation.navigate('MessageThread', { threadId: existing.id, otherUserName: otherName });
      return;
    }

    // Create new thread
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', otherId)
      .single();
    const otherName = (profile as any)?.display_name ?? 'User';

    const { data: newThread } = await supabase
      .from('message_threads')
      .insert({ user1_id: uid, user2_id: otherId, last_message_at: new Date().toISOString() })
      .select()
      .single();

    if (newThread) {
      navigation.navigate('MessageThread', { threadId: newThread.id, otherUserName: otherName });
    }
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Messages</Text>
      </View>
      {threads.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyText}>No conversations yet</Text>
          <Text style={s.emptySubText}>Start a conversation from a user profile</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={t => t.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.threadRow}
              onPress={() => navigation.navigate('MessageThread', {
                threadId: item.id,
                otherUserName: item.other_user_name,
              })}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.other_user_name[0]?.toUpperCase()}</Text>
              </View>
              <View style={s.threadInfo}>
                <View style={s.threadTop}>
                  <Text style={s.threadName}>{item.other_user_name}</Text>
                  <Text style={s.threadTime}>{formatTime(item.last_message_at)}</Text>
                </View>
                <View style={s.threadBottom}>
                  <Text style={s.threadPreview} numberOfLines={1}>
                    {item.last_message || 'No messages yet'}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#f1f5f9', marginBottom: 6 },
  emptySubText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  threadRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  threadInfo: { flex: 1 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  threadName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  threadTime: { fontSize: 12, color: '#64748b' },
  threadBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadPreview: { fontSize: 13, color: '#64748b', flex: 1 },
  badge: { backgroundColor: '#6366f1', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#1e293b', marginLeft: 76 },
});
