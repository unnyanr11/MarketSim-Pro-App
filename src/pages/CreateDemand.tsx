import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { demandService } from '../services/demand.service';
import { supabase } from '../supabase/client';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'CreateDemand'>;

export default function CreateDemandPage() {
  const navigation = useNavigation<NavProp>();
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [qualityStars, setQualityStars] = useState('3');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [region, setRegion] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isGoodDeal, setIsGoodDeal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!productName || !quantity) {
      Alert.alert('Error', 'Product name and quantity are required.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('Error', 'Not authenticated.'); return; }

    setLoading(true);
    try {
      await demandService.createDemand({
        userId: user.id,
        type,
        productName,
        productCategory: productCategory || undefined,
        quantity: parseInt(quantity, 10) || 0,
        qualityStars: parseInt(qualityStars, 10) || 3,
        discountPercentage: discountPercentage ? parseFloat(discountPercentage) : undefined,
        region: region || null,
        isUrgent,
        isGoodDeal,
        priceType: discountPercentage ? 'market-discount' : 'negotiable',
      });
      Alert.alert('Success', 'Demand posted!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Post Demand</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Type Toggle */}
      <View style={styles.card}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.toggle}>
          {(['buy', 'sell'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.toggleBtn, type === t && styles.toggleBtnActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.toggleText, type === t && styles.toggleTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Product Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. Steel Rods" placeholderTextColor="#64748b"
          value={productName} onChangeText={setProductName} />

        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} placeholder="e.g. Metals" placeholderTextColor="#64748b"
          value={productCategory} onChangeText={setProductCategory} />

        <Text style={styles.label}>Quantity *</Text>
        <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor="#64748b"
          value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

        <Text style={styles.label}>Quality (1-5 stars)</Text>
        <TextInput style={styles.input} placeholder="3" placeholderTextColor="#64748b"
          value={qualityStars} onChangeText={setQualityStars} keyboardType="numeric" />

        <Text style={styles.label}>Discount % (optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. 10" placeholderTextColor="#64748b"
          value={discountPercentage} onChangeText={setDiscountPercentage} keyboardType="numeric" />

        <Text style={styles.label}>Region (optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. North India" placeholderTextColor="#64748b"
          value={region} onChangeText={setRegion} />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Urgent?</Text>
          <Switch value={isUrgent} onValueChange={setIsUrgent} trackColor={{ true: '#6366f1' }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Good Deal?</Text>
          <Switch value={isGoodDeal} onValueChange={setIsGoodDeal} trackColor={{ true: '#6366f1' }} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={handleCreate} disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Post Demand</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, backgroundColor: '#1e293b' },
  back: { color: '#6366f1', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  card: { backgroundColor: '#1e293b', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', borderWidth: 1, borderColor: '#334155' },
  toggle: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  toggleBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  toggleText: { color: '#94a3b8', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  btn: { backgroundColor: '#6366f1', borderRadius: 10, padding: 15, alignItems: 'center', marginHorizontal: 12, marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
