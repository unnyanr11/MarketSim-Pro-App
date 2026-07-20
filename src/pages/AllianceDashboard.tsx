/**
 * AllianceDashboard.tsx — Alliance overview: info, members, actions
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AllianceDashboard'>;

interface Member {
  user_id: string;
  display_name: string;
  role: string;
}

interface AllianceData {
  id: string;
  name: string;
  description: string;
  region: string;
  is_public: boolean;
  member_count: number;
  owner_id: string;
}

export default function AllianceDashboard({ route, navigation }: Props) {
  const { allianceId } = route.params;
  const [alliance, setAlliance] = useState<AllianceData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.from('Alliances').select('*').eq('id', allianceId).single(),
        supabase.from('AllianceMembers').select('user_id, role, UserProfile:user_id(display_name)').eq('alliance_id', allianceId),
      ]);
      setAlliance(a as AllianceData);
      const memberList = (m as any[])?.map(x => ({ user_id: x.user_id, display_name: x.UserProfile?.display_name ?? 'Unknown', role: x.role })) ?? [];
      setMembers(memberList);
      if (user) setIsMember(memberList.some(m => m.user_id === user.id));
      setLoading(false);
    })();
  }, [allianceId]);

  const joinAlliance = async () => {
    const { error } = await supabase.from('AllianceMembers').insert({ alliance_id: allianceId, user_id: currentUserId, role: 'member' });
    if (error) { Alert.alert('Error', error.message); return; }
    await supabase.from('Alliances').update({ member_count: (alliance?.member_count ?? 0) + 1 }).eq('id', allianceId);
    setIsMember(true);
  };

  const leaveAlliance = async () => {
    Alert.alert('Leave Alliance', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        await supabase.from('AllianceMembers').delete().eq('alliance_id', allianceId).eq('user_id', currentUserId);
        setIsMember(false);
        navigation.goBack();
      }},
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" /></View>;
  if (!alliance) return <View style={s.center}><Text style={s.errorText}>Alliance not found</Text></View>;

  const isOwner = alliance.owner_id === currentUserId;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{alliance.name}</Text>
        {isOwner && (
          <TouchableOpacity style={s.settingsBtn} onPress={() => navigation.navigate('AllianceSettings', { allianceId })}>
            <Text style={s.settingsText}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.infoCard}>
        {!!alliance.description && <Text style={s.desc}>{alliance.description}</Text>}
        <View style={s.metaRow}>
          {!!alliance.region && <Text style={s.meta}>🌍 {alliance.region}</Text>}
          <Text style={s.meta}>👥 {alliance.member_count} members</Text>
          <Text style={s.meta}>{alliance.is_public ? '🔓 Public' : '🔒 Private'}</Text>
        </View>
      </View>

      <View style={s.actionsRow}>
        {isMember ? (
          <>
            <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('AllianceChat', { allianceId, allianceName: alliance.name })}>
              <Text style={s.btnText}>💬 Chat</Text>
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity style={s.btnDanger} onPress={leaveAlliance}>
                <Text style={s.btnDangerText}>Leave</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity style={s.btnPrimary} onPress={joinAlliance}>
            <Text style={s.btnText}>Join Alliance</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.sectionTitle}>Members ({members.length})</Text>
      {members.map(m => (
        <TouchableOpacity key={m.user_id} style={s.memberRow} onPress={() => navigation.navigate('Profile', { userId: m.user_id })}>
          <View style={s.avatar}><Text style={s.avatarText}>{m.display_name[0]?.toUpperCase()}</Text></View>
          <Text style={s.memberName}>{m.display_name}</Text>
          {m.role === 'owner' && <View style={s.ownerBadge}><Text style={s.ownerText}>Owner</Text></View>}
        </TouchableOpacity>
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', flex: 1 },
  settingsBtn: { padding: 4 },
  settingsText: { fontSize: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#64748b', fontSize: 16 },
  infoCard: { backgroundColor: '#1e293b', borderRadius: 12, margin: 16, padding: 16 },
  desc: { fontSize: 14, color: '#94a3b8', marginBottom: 12, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  meta: { fontSize: 13, color: '#64748b' },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDanger: { backgroundColor: '#450a0a', borderRadius: 10, padding: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#991b1b' },
  btnDangerText: { color: '#fca5a5', fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#f1f5f9', fontWeight: '700' },
  memberName: { flex: 1, fontSize: 14, color: '#f1f5f9' },
  ownerBadge: { backgroundColor: '#6366f1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  ownerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
