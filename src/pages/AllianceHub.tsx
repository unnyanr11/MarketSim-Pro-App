/**
 * AllianceHub.tsx — Browse and join alliances
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AllianceHub'>;

interface Alliance {
  id: string;
  name: string;
  description: string;
  member_count: number;
  is_public: boolean;
  region: string;
  created_at: string;
}

export default function AllianceHub({ navigation }: Props) {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [filtered, setFiltered] = useState<Alliance[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('Alliances')
      .select('*')
      .eq('is_public', true)
      .order('member_count', { ascending: false })
      .then(({ data }) => {
        setAlliances((data as Alliance[]) ?? []);
        setFiltered((data as Alliance[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(alliances.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    ));
  }, [search, alliances]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Alliances</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('AllianceCreate')}>
          <Text style={s.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={s.search}
        placeholder="Search alliances…"
        placeholderTextColor="#475569"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('AllianceDashboard', { allianceId: item.id })}
          >
            <View style={s.cardTop}>
              <Text style={s.allianceName}>{item.name}</Text>
              <View style={s.memberBadge}>
                <Text style={s.memberText}>👥 {item.member_count}</Text>
              </View>
            </View>
            {!!item.description && <Text style={s.desc} numberOfLines={2}>{item.description}</Text>}
            {!!item.region && <Text style={s.region}>🌍 {item.region}</Text>}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No alliances found</Text></View>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', flex: 1 },
  createBtn: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  search: { margin: 16, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#64748b', fontSize: 15 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  allianceName: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1 },
  memberBadge: { backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  memberText: { fontSize: 12, color: '#93c5fd' },
  desc: { fontSize: 13, color: '#94a3b8', marginBottom: 8 },
  region: { fontSize: 12, color: '#64748b' },
});
