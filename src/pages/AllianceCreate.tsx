/**
 * AllianceCreate.tsx — Create a new alliance
 */
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AllianceCreate'>;

export default function AllianceCreate({ navigation }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState('50');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Alliance name is required.'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('Alliances').insert({
        name: name.trim(),
        description: description.trim(),
        region: region.trim(),
        is_public: isPublic,
        max_members: parseInt(maxMembers) || 50,
        owner_id: user.id,
        member_count: 1,
        created_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      // Add owner as member
      await supabase.from('AllianceMembers').insert({ alliance_id: data.id, user_id: user.id, role: 'owner' });
      navigation.replace('AllianceDashboard', { allianceId: data.id });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Create Alliance</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Alliance name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Steel Giants" placeholderTextColor="#475569" />

          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, s.textarea]} value={description} onChangeText={setDescription} placeholder="What is your alliance about?" placeholderTextColor="#475569" multiline maxLength={500} />

          <Text style={s.label}>Region</Text>
          <TextInput style={s.input} value={region} onChangeText={setRegion} placeholder="e.g. Europe" placeholderTextColor="#475569" />

          <Text style={s.label}>Max members</Text>
          <TextInput style={s.input} value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" placeholder="50" placeholderTextColor="#475569" />

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Public alliance</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: '#334155', true: '#6366f1' }} thumbColor="#fff" />
          </View>
          <Text style={s.hint}>{isPublic ? 'Visible in the Alliance Hub and open to join requests' : 'Invite-only — not listed publicly'}</Text>
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleCreate} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Creating…' : 'Create Alliance'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 16 },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginHorizontal: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 14, color: '#f1f5f9' },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  btn: { backgroundColor: '#6366f1', borderRadius: 10, padding: 15, alignItems: 'center', margin: 16, marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
