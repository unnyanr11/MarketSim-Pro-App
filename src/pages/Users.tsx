/**
 * Users.tsx — Browse marketplace users
 * Navigates to UserProfile (public view) not Profile (own edit)
 * DB: user_profiles (lowercase, matching web)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Users'>;

interface UserRow {
  user_id: string;
  display_name: string;
  company_name: string;
  region: string;
  bio: string;
}

export default function Users({ navigation }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('user_profiles')
      .select('user_id, display_name, company_name, region, bio')
      .order('display_name')
      .then(({ data }) => {
        setUsers((data as UserRow[]) ?? []);
        setFiltered((data as UserRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(users.filter(u =>
      u.display_name?.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q) ||
      u.region?.toLowerCase().includes(q)
    ));
  }, [search, users]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Users</Text>
      </View>
      <TextInput
        style={s.search}
        placeholder="Search by name, company or region…"
        placeholderTextColor="#475569"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={u => u.user_id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>{item.display_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={s.info}>
              <Text style={s.name}>{item.display_name}</Text>
              <Text style={s.company}>{item.company_name}</Text>
              {!!item.region && <Text style={s.region}>🌍 {item.region}</Text>}
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No users found</Text></View>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  search: { margin: 16, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#64748b', fontSize: 15 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  company: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  region: { fontSize: 12, color: '#64748b', marginTop: 2 },
  chevron: { color: '#475569', fontSize: 22 },
});
