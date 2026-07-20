/**
 * MessageThread.tsx — Individual chat conversation
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'MessageThread'>;

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export default function MessageThread({ route, navigation }: Props) {
  const { threadId, otherUserName } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchMessages();
    const channel = supabase
      .channel(`thread_${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Messages', filter: `thread_id=eq.${threadId}` },
        payload => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('Messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    await supabase.from('Messages').insert({ thread_id: threadId, sender_id: userId, content });
    await supabase.from('MessageThreads').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', threadId);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.avatar}><Text style={s.avatarText}>{otherUserName[0]?.toUpperCase()}</Text></View>
        <Text style={s.headerTitle}>{otherUserName}</Text>
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color="#6366f1" /></View> : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          renderItem={({ item }) => {
            const mine = item.sender_id === userId;
            return (
              <View style={[s.bubbleWrap, mine ? s.bubbleWrapMine : s.bubbleWrapOther]}>
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                  <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextOther]}>{item.content}</Text>
                  <Text style={s.bubbleTime}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor="#475569"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]} onPress={sendMessage} disabled={!text.trim()}>
          <Text style={s.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 8, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#f1f5f9', flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bubbleWrap: { marginBottom: 8 },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10 },
  bubbleMine: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextOther: { color: '#f1f5f9' },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#1e293b' },
  input: { flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#f1f5f9', fontSize: 15, maxHeight: 100, marginRight: 8 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#334155' },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
