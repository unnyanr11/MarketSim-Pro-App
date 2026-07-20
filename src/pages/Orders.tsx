/**
 * Orders.tsx — Completed and active orders
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Orders'>;

type TabType = 'buying' | 'selling';

interface Order {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  status: string;
  created_at: string;
  counterpart_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#eab308',
  active: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

export default function Orders({ navigation }: Props) {
  const [tab, setTab] = useState<TabType>('buying');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, [tab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const col = tab === 'buying' ? 'buyer_id' : 'seller_id';
      const otherCol = tab === 'buying' ? 'seller_id' : 'buyer_id';
      const { data } = await supabase
        .from('Orders')
        .select(`*, Product:product_id(name), Counterpart:${otherCol}(display_name)`)
        .eq(col, user.id)
        .order('created_at', { ascending: false });
      setOrders((data as any[])?.map(o => ({
        id: o.id,
        product_name: o.Product?.name ?? 'Unknown product',
        quantity: o.quantity,
        price: o.price,
        status: o.status,
        created_at: o.created_at,
        counterpart_name: o.Counterpart?.display_name ?? 'Unknown',
      })) ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Orders</Text>
      </View>

      <View style={s.tabs}>
        {(['buying', 'selling'] as TabType[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'buying' ? 'Buying' : 'Selling'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color="#6366f1" /></View> : orders.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📦</Text>
          <Text style={s.emptyText}>No {tab} orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.productName}>{item.product_name}</Text>
                <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? '#64748b' }]}>
                  <Text style={s.statusText}>{item.status}</Text>
                </View>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Qty</Text>
                <Text style={s.cardValue}>{item.quantity.toLocaleString()}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Price</Text>
                <Text style={s.cardValue}>§{item.price.toLocaleString()}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>{tab === 'buying' ? 'Seller' : 'Buyer'}</Text>
                <Text style={s.cardValue}>{item.counterpart_name}</Text>
              </View>
              <Text style={s.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
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
  tabs: { flexDirection: 'row', margin: 16, backgroundColor: '#1e293b', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#64748b' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  productName: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardLabel: { fontSize: 13, color: '#64748b' },
  cardValue: { fontSize: 13, color: '#f1f5f9', fontWeight: '600' },
  cardDate: { fontSize: 11, color: '#475569', marginTop: 8 },
});
