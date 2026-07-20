import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { bidService, type Bid } from '../services/bid.service';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'MyBids'>;

const STATUS_COLORS: Record<string, string> = {
  pending: '#1e3a5f',
  accepted: '#065f46',
  rejected: '#7f1d1d',
  withdrawn: '#1e293b',
};
const STATUS_TEXT: Record<string, string> = {
  pending: '#93c5fd',
  accepted: '#6ee7b7',
  rejected: '#fca5a5',
  withdrawn: '#64748b',
};

export default function MyBidsPage() {
  const navigation = useNavigation<NavProp>();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBids = async () => {
    try {
      const data = await bidService.getMyBids();
      setBids(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBids(); }, []);

  const handleWithdraw = (bidId: string) => {
    Alert.alert('Withdraw Bid', 'Are you sure you want to withdraw this bid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw', style: 'destructive', onPress: async () => {
          try {
            await bidService.withdrawBid(bidId);
            fetchBids();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Bids</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={bids}
        keyExtractor={(b) => b.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBids(); }} tintColor="#6366f1" />}
        contentContainerStyle={bids.length === 0 ? styles.centered : { paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>You haven't placed any bids yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('DemandDetail', { demandId: item.demandId })}
          >
            <View style={styles.topRow}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? '#1e293b' }]}>
                <Text style={[styles.statusText, { color: STATUS_TEXT[item.status] ?? '#94a3b8' }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
              {item.discountPercentage != null && (
                <Text style={styles.discount}>{item.discountPercentage}% off</Text>
              )}
            </View>
            <Text style={styles.demandId} numberOfLines={1}>Demand: {item.demandId}</Text>
            {item.message ? <Text style={styles.message} numberOfLines={2}>{item.message}</Text> : null}
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            {item.status === 'pending' && (
              <TouchableOpacity style={styles.withdrawBtn} onPress={() => handleWithdraw(item.id)}>
                <Text style={styles.withdrawText}>Withdraw</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, backgroundColor: '#1e293b' },
  back: { color: '#6366f1', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  card: { backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  discount: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  demandId: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  message: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  date: { fontSize: 11, color: '#475569' },
  withdrawBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#7f1d1d', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  withdrawText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  empty: { color: '#475569', fontSize: 15 },
});
