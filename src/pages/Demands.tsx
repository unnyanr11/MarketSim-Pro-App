import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { demandService, type DemandData } from '../services/demand.service';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Demands'>;
type Props = NativeStackScreenProps<RootStackParamList, 'Demands'>;

export default function DemandsPage() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<Props['route']>();
  const initialFilter = route.params?.filter;

  const [demands, setDemands] = useState<DemandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'buy' | 'sell' | undefined>(initialFilter);

  const fetchDemands = useCallback(async () => {
    try {
      const { demands } = await demandService.getDemands(
        { type: typeFilter, search: search || undefined },
        { field: 'createdAt', direction: 'desc' },
        30
      );
      setDemands(demands);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, search]);

  useEffect(() => { fetchDemands(); }, [fetchDemands]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Demands</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateDemand')}>
          <Text style={styles.addBtn}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={styles.search}
        placeholder="Search demands..."
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={fetchDemands}
        returnKeyType="search"
      />

      {/* Type Filters */}
      <View style={styles.filters}>
        {(['all', 'buy', 'sell'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, (f === 'all' ? !typeFilter : typeFilter === f) && styles.chipActive]}
            onPress={() => setTypeFilter(f === 'all' ? undefined : f)}
          >
            <Text style={[styles.chipText, (f === 'all' ? !typeFilter : typeFilter === f) && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>
      ) : (
        <FlatList
          data={demands}
          keyExtractor={(d) => d.demandId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDemands(); }} tintColor="#6366f1" />}
          contentContainerStyle={demands.length === 0 ? styles.centered : { paddingBottom: 24 }}
          ListEmptyComponent={<Text style={styles.empty}>No demands found.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DemandDetail', { demandId: item.demandId })}
            >
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: item.type === 'buy' ? '#1d4ed8' : '#065f46' }]}>
                  <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
                </View>
                {item.isUrgent && <View style={styles.urgentBadge}><Text style={styles.urgentText}>URGENT</Text></View>}
                {item.biddingClosed && <View style={styles.closedBadge}><Text style={styles.closedText}>CLOSED</Text></View>}
              </View>
              <Text style={styles.productName}>{item.productName}</Text>
              {item.userCompanyName ? <Text style={styles.company}>{item.userCompanyName}</Text> : null}
              <View style={styles.footer}>
                <Text style={styles.meta}>Qty: {item.quantity}</Text>
                {item.discountPercentage != null && <Text style={styles.meta}>{item.discountPercentage}% off</Text>}
                {item.region ? <Text style={styles.meta}>📍 {item.region}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, backgroundColor: '#1e293b' },
  backBtn: { padding: 4 },
  backText: { color: '#6366f1', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  addBtn: { color: '#6366f1', fontWeight: '700', fontSize: 15 },
  search: { margin: 12, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, color: '#f1f5f9', borderWidth: 1, borderColor: '#334155' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  urgentBadge: { backgroundColor: '#7f1d1d', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  urgentText: { color: '#fca5a5', fontSize: 10, fontWeight: '700' },
  closedBadge: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  closedText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  productName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', marginBottom: 2 },
  company: { fontSize: 12, color: '#6366f1', marginBottom: 4 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 4 },
  meta: { fontSize: 12, color: '#64748b' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { color: '#475569', fontSize: 15 },
});
