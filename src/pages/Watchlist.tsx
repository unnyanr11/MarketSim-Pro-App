/**
 * Watchlist.tsx — User's saved/followed demands
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Watchlist'>;

interface WatchedDemand {
  id: string;
  title: string;
  product_name: string;
  demand_type: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: string;
  region: string;
}

export default function Watchlist({ navigation }: Props) {
  const [items, setItems] = useState<WatchedDemand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('Watchlist')
        .select('demand_id, Demand:demand_id(id, title, product_name, demand_type, quantity, price, status, region)')
        .eq('user_id', user.id);
      setItems((data as any[])?.map(w => w.Demand).filter(Boolean) ?? []);
      setLoading(false);
    })();
  }, []);

  const removeFromWatchlist = async (demandId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('Watchlist').delete().eq('user_id', user.id).eq('demand_id', demandId);
    setItems(prev => prev.filter(i => i.id !== demandId));
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Watchlist</Text>
      </View>
      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>⭐</Text>
          <Text style={s.emptyText}>Your watchlist is empty</Text>
          <Text style={s.emptySubText}>Tap the star on any demand to save it here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('DemandDetail', { demandId: item.id })}
            >
              <View style={s.cardTop}>
                <View style={[s.typeBadge, item.demand_type === 'buy' ? s.buyBadge : s.sellBadge]}>
                  <Text style={s.typeText}>{item.demand_type.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFromWatchlist(item.id)} style={s.removeBtn}>
                  <Text style={s.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.title}>{item.title || item.product_name}</Text>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Quantity</Text>
                <Text style={s.cardValue}>{item.quantity?.toLocaleString()}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Price</Text>
                <Text style={s.cardValue}>§{item.price?.toLocaleString()}</Text>
              </View>
              {!!item.region && <Text style={s.region}>🌍 {item.region}</Text>}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#f1f5f9', marginBottom: 6 },
  emptySubText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  buyBadge: { backgroundColor: '#052e16' },
  sellBadge: { backgroundColor: '#450a0a' },
  typeText: { fontSize: 11, fontWeight: '700' },
  removeBtn: { padding: 4 },
  removeBtnText: { color: '#64748b', fontSize: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { fontSize: 13, color: '#64748b' },
  cardValue: { fontSize: 13, color: '#f1f5f9', fontWeight: '600' },
  region: { fontSize: 12, color: '#475569', marginTop: 8 },
});
