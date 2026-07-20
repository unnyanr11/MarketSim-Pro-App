/**
 * Dashboard — matches MarketSim-Pro web:
 *  - Stat cards: Active demands, My bids, Unread messages, My alliances
 *  - Quick action cards: Browse demands, Create demand, Track bids, Alliances
 *  - DB table names match web: demands, bids, messages, alliance_members
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

interface Stats {
  myActiveDemands: number;
  myBids: number;
  unreadMessages: number;
  myAlliances: number;
}

const ICON: Record<string, string> = {
  demands: '\uD83D\uDED2',
  bids: '\uD83D\uDD28',
  messages: '\uD83D\uDCAC',
  alliances: '\uD83D\uDEE1\uFE0F',
};

const COLORS: Record<string, string> = {
  demands: '#1d4ed8',
  bids: '#d97706',
  messages: '#7c3aed',
  alliances: '#059669',
};

export default function DashboardPage() {
  const navigation = useNavigation<NavProp>();
  const [stats, setStats] = useState<Stats>({ myActiveDemands: 0, myBids: 0, unreadMessages: 0, myAlliances: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setDisplayName(
        user.user_metadata?.display_name ||
        user.email?.split('@')[0] ||
        ''
      );

      const [demandsRes, bidsRes, msgsRes, alliancesRes] = await Promise.all([
        supabase.from('demands').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('status', 'open'),
        supabase.from('bids').select('id', { count: 'exact', head: true })
          .eq('bidder_id', user.id),
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id).eq('is_read', false),
        supabase.from('alliance_members').select('alliance_id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('status', 'active'),
      ]);

      setStats({
        myActiveDemands: demandsRes.count ?? 0,
        myBids: bidsRes.count ?? 0,
        unreadMessages: msgsRes.count ?? 0,
        myAlliances: alliancesRes.count ?? 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  const statCards = [
    { key: 'demands', label: 'Active demands', value: stats.myActiveDemands, onPress: () => navigation.navigate('Demands') },
    { key: 'bids', label: 'My bids', value: stats.myBids, onPress: () => navigation.navigate('MyBids') },
    { key: 'messages', label: 'Unread messages', value: stats.unreadMessages, onPress: () => navigation.navigate('Messages') },
    { key: 'alliances', label: 'My alliances', value: stats.myAlliances, onPress: () => navigation.navigate('AllianceHub') },
  ];

  const quickActions = [
    { icon: '\uD83D\uDCCB', title: 'Browse demands', desc: 'Find opportunities that match your products.', onPress: () => navigation.navigate('Demands') },
    { icon: '\u2795', title: 'Create a demand', desc: 'Post your buy/sell request to the market.', onPress: () => navigation.navigate('CreateDemand') },
    { icon: '\uD83D\uDCC8', title: 'Track my bids', desc: 'See the status of all your placed bids.', onPress: () => navigation.navigate('MyBids') },
    { icon: '\uD83D\uDEE1\uFE0F', title: 'Alliances', desc: 'Join or manage trading alliances with others.', onPress: () => navigation.navigate('AllianceHub') },
  ];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>
            Welcome{displayName ? `, ${displayName}` : ''} \uD83D\uDC4B
          </Text>
          <Text style={s.headerSub}>Your trading overview and quick actions</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Text style={s.iconBtnText}>\uD83D\uDD14</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={s.iconBtnText}>\uD83D\uDC64</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={handleLogout}>
            <Text style={s.iconBtnText}>\u21A9</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stat cards */}
      <Text style={s.sectionLabel}>YOUR ACTIVITY</Text>
      <View style={s.grid}>
        {statCards.map(c => (
          <TouchableOpacity key={c.key} style={s.statCard} onPress={c.onPress}>
            <View style={[s.statIconWrap, { backgroundColor: COLORS[c.key] + '22' }]}>
              <Text style={s.statIcon}>{ICON[c.key]}</Text>
            </View>
            <Text style={s.statValue}>{c.value}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick actions */}
      <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
      <View style={s.grid}>
        {quickActions.map(a => (
          <TouchableOpacity key={a.title} style={s.actionCard} onPress={a.onPress}>
            <Text style={s.actionIcon}>{a.icon}</Text>
            <Text style={s.actionTitle}>{a.title}</Text>
            <Text style={s.actionDesc}>{a.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerLeft: { flex: 1, paddingRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  iconBtnText: { fontSize: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  statCard: { width: '47%', backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  statIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#64748b' },
  actionCard: { width: '47%', backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  actionIcon: { fontSize: 24, marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  actionDesc: { fontSize: 12, color: '#64748b', lineHeight: 16 },
});
