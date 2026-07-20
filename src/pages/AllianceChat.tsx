/**
 * AllianceChat.tsx — Alliance group chat with real-time messages
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AllianceChat'>;

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
}

export default function AllianceChat({ route, navigation }: Props) {
  const { allianceId, allianceName } = route.params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from('UserProfile').select('display_name').eq('user_id', user.id).single();
        setUserName(data?.display_name ?? 'User');
      }
      const { data } = await supabase
        .from('AllianceMessages')
        .select('*, Sender:sender_id(display_name)')
        .eq('alliance_id', allianceId)
        .order('created_at', { ascending: true })
        .limit(100);
      setMessages((data as any[])?.map(m => ({ id: m.id, content: m.content, sender_id: m.sender_id, sender_name: m.Sender?.display_name ?? 'Unknown', created_at: m.created_at })) ?? []);
      setLoading(false);
    })();

    const channel = supabase.channel(`alliance_${allianceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'AllianceMessages', filter: `alliance_id=eq.${allianceId}` },
        async payload => {
          const { data } = await supabase.from('UserProfile').select('display_name').eq('user_id', payload.new.sender_id).single();
          setMessages(prev => [...prev, { ...payload.new as any, sender_name: data?.display_name ?? 'Unknown' }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [allianceId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    await supabase.from('AllianceMessages').insert({ alliance_id: allianceId, sender_id: userId, content, created_at: new Date().toISOString() });
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>{allianceName}</Text>
          <Text style={s.headerSub}>Alliance Chat</Text>
        </View>
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
                {!mine && <Text style={s.senderName}>{item.sender_name}</Text>}
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
          placeholder="Message the alliance…"
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
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  headerSub: { fontSize: 12, color: '#64748b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bubbleWrap: { marginBottom: 10 },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: '#64748b', marginBottom: 2, marginLeft: 4 },
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
