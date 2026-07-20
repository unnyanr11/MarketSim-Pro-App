import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { demandService, type DemandData } from '../services/demand.service';
import { bidService, type Bid } from '../services/bid.service';
import { supabase } from '../supabase/client';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'DemandDetail'>;
type Props = NativeStackScreenProps<RootStackParamList, 'DemandDetail'>;

export default function DemandDetailPage() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<Props['route']>();
  const { demandId } = route.params;

  const [demand, setDemand] = useState<DemandData | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasBid, setHasBid] = useState(false);
  const [bidding, setBidding] = useState(false);
  const [discountInput, setDiscountInput] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      const [d, b, hb] = await Promise.all([
        demandService.getDemand(demandId),
        bidService.getBidsForDemand(demandId),
        bidService.hasUserBid(demandId),
      ]);
      setDemand(d);
      setBids(b);
      setHasBid(hb);
      setLoading(false);
    };
    load();
    const unsub = bidService.subscribeToBids(demandId, (updated) => setBids(updated));
    return unsub;
  }, [demandId]);

  const handlePlaceBid = async () => {
    const pct = parseFloat(discountInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Alert.alert('Invalid', 'Enter a discount percentage between 0 and 100.');
      return;
    }
    setBidding(true);
    try {
      await bidService.placeBid({ demandId, discountPercentage: pct });
      setHasBid(true);
      Alert.alert('Success', 'Your bid has been placed!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBidding(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    Alert.alert('Accept Bid', 'Are you sure you want to accept this bid? All other bids will be rejected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept', onPress: async () => {
          try {
            await bidService.acceptBid(bidId, demandId);
            const updated = await bidService.getBidsForDemand(demandId);
            setBids(updated);
            const updatedDemand = await demandService.getDemand(demandId);
            setDemand(updatedDemand);
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>;
  if (!demand) return <View style={styles.centered}><Text style={styles.empty}>Demand not found.</Text></View>;

  const isOwner = userId === demand.userId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Demand Info */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: demand.type === 'buy' ? '#1d4ed8' : '#065f46' }]}>
            <Text style={styles.badgeText}>{demand.type.toUpperCase()}</Text>
          </View>
          {demand.isUrgent && <View style={styles.urgentBadge}><Text style={styles.urgentText}>URGENT</Text></View>}
          {demand.biddingClosed && <View style={styles.closedBadge}><Text style={styles.closedText}>BIDDING CLOSED</Text></View>}
        </View>
        <Text style={styles.productName}>{demand.productName}</Text>
        {demand.userCompanyName ? <Text style={styles.company}>{demand.userCompanyName}</Text> : null}
        <View style={styles.detailGrid}>
          <Text style={styles.detail}>Qty: {demand.quantity}</Text>
          {demand.discountPercentage != null && <Text style={styles.detail}>{demand.discountPercentage}% off</Text>}
          {demand.region ? <Text style={styles.detail}>📍 {demand.region}</Text> : null}
          <Text style={styles.detail}>⭐ {demand.qualityStars}/5</Text>
          {demand.expiresAt ? <Text style={styles.detail}>Expires: {new Date(demand.expiresAt).toLocaleDateString()}</Text> : null}
        </View>
      </View>

      {/* Place Bid (non-owner, bidding open) */}
      {!isOwner && !demand.biddingClosed && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{hasBid ? '✅ Bid Placed' : 'Place a Bid'}</Text>
          {!hasBid && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Discount % (0-100)"
                placeholderTextColor="#64748b"
                value={discountInput}
                onChangeText={setDiscountInput}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.btn, bidding && { opacity: 0.6 }]}
                onPress={handlePlaceBid}
                disabled={bidding}
              >
                {bidding ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit Bid</Text>}
              </TouchableOpacity>
            </>
          )}
          {hasBid && <Text style={styles.meta}>You have already placed a bid on this demand.</Text>}
        </View>
      )}

      {/* Bids List (owner only) */}
      {isOwner && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bids ({bids.length})</Text>
          {bids.length === 0 && <Text style={styles.meta}>No bids yet.</Text>}
          {bids.map((bid) => (
            <View key={bid.id} style={styles.bidRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bidder}>{bid.bidderName ?? 'Anonymous'}</Text>
                {bid.bidderCompany ? <Text style={styles.bidMeta}>{bid.bidderCompany}</Text> : null}
                {bid.discountPercentage != null && <Text style={styles.bidMeta}>{bid.discountPercentage}% off</Text>}
                <View style={[styles.statusBadge, { backgroundColor: bid.status === 'accepted' ? '#065f46' : bid.status === 'rejected' ? '#7f1d1d' : '#1e3a5f' }]}>
                  <Text style={styles.statusText}>{bid.status.toUpperCase()}</Text>
                </View>
              </View>
              {bid.status === 'pending' && !demand.biddingClosed && (
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptBid(bid.id)}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#1e293b' },
  back: { color: '#6366f1', fontSize: 15 },
  card: { backgroundColor: '#1e293b', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  urgentBadge: { backgroundColor: '#7f1d1d', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  urgentText: { color: '#fca5a5', fontSize: 10, fontWeight: '700' },
  closedBadge: { borderWidth: 1, borderColor: '#475569', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  closedText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  productName: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  company: { fontSize: 13, color: '#6366f1', marginBottom: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  detail: { fontSize: 13, color: '#94a3b8', backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  btn: { backgroundColor: '#6366f1', borderRadius: 8, padding: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  meta: { color: '#64748b', fontSize: 13 },
  empty: { color: '#475569', fontSize: 15 },
  bidRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  bidder: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  bidMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  acceptBtn: { backgroundColor: '#065f46', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  acceptText: { color: '#6ee7b7', fontWeight: '700', fontSize: 13 },
});
