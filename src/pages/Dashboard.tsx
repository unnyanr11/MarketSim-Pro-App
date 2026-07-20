import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { ordersService, type OrderData } from '../services/order.service';
import { supabase } from '../supabase/client';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function DashboardPage() {
  const navigation = useNavigation<NavProp>();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchOrders = async () => {
    try {
      const { orders } = await ordersService.getOrders(
        {},
        { field: 'createdAt', direction: 'desc' },
        20
      );
      setOrders(orders);
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MarketSim Pro</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.headerBtnText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.headerBtnText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleLogout}>
            <Text style={styles.headerBtnText}>↩</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: '#6366f1' }]}
          onPress={() => navigation.navigate('CreateDemand')}
        >
          <Text style={styles.quickBtnText}>+ Post Demand</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#6366f1' }]}
          onPress={() => navigation.navigate('MyBids')}
        >
          <Text style={styles.quickBtnText}>My Bids</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Filters */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => navigation.navigate('Demands', { filter: 'buy' })}
        >
          <Text style={styles.filterChipText}>Buy Demands</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => navigation.navigate('Demands', { filter: 'sell' })}
        >
          <Text style={styles.filterChipText}>Sell Demands</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => navigation.navigate('Demands')}
        >
          <Text style={styles.filterChipText}>All</Text>
        </TouchableOpacity>
      </View>

      {/* Orders Feed */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.demandId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No demands yet. Be the first to post!</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('DemandDetail', { demandId: item.demandId })}
          >
            <View style={styles.cardRow}>
              <View style={[styles.typeBadge, { backgroundColor: item.type === 'buy' ? '#1d4ed8' : '#065f46' }]}>
                <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
              </View>
              {item.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
            </View>
            <Text style={styles.productName}>{item.productName}</Text>
            {item.userCompanyName ? (
              <Text style={styles.companyName}>{item.userCompanyName}</Text>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>Qty: {item.quantity}</Text>
              {item.discountPercentage != null && (
                <Text style={styles.metaText}>{item.discountPercentage}% off</Text>
              )}
              <Text style={styles.metaText}>
                {'⭐'.repeat(Math.min(item.qualityStars || 0, 5))}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#1e293b',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 8 },
  headerBtnText: { fontSize: 20 },
  quickActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
  },
  quickBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  quickBtnText: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  filters: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
  },
  filterChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  card: {
    backgroundColor: '#1e293b', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155',
  },
  cardRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  urgentBadge: { backgroundColor: '#7f1d1d', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  urgentText: { color: '#fca5a5', fontSize: 10, fontWeight: '700' },
  productName: { fontSize: 16, fontWeight: '600', color: '#f1f5f9', marginBottom: 2 },
  companyName: { fontSize: 12, color: '#6366f1', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', gap: 12, marginTop: 6 },
  metaText: { fontSize: 12, color: '#64748b' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#475569', fontSize: 15, textAlign: 'center' },
});
