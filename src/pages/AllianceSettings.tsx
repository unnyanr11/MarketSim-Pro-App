/**
 * AllianceSettings.tsx — Edit alliance info (owner only)
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AllianceSettings'>;

export default function AllianceSettings({ route, navigation }: Props) {
  const { allianceId } = route.params;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState('50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('Alliances').select('*').eq('id', allianceId).single()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? '');
          setDescription(data.description ?? '');
          setRegion(data.region ?? '');
          setIsPublic(data.is_public ?? true);
          setMaxMembers(String(data.max_members ?? 50));
        }
        setLoading(false);
      });
  }, [allianceId]);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('Alliances').update({
        name: name.trim(),
        description: description.trim(),
        region: region.trim(),
        is_public: isPublic,
        max_members: parseInt(maxMembers) || 50,
      }).eq('id', allianceId);
      if (error) throw error;
      Alert.alert('Saved', 'Alliance settings updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAlliance = () => {
    Alert.alert('Delete Alliance', 'This cannot be undone. All members will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('AllianceMembers').delete().eq('alliance_id', allianceId);
        await supabase.from('Alliances').delete().eq('id', allianceId);
        navigation.navigate('AllianceHub');
      }},
    ]);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: '#0f172a' }} />;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Alliance Settings</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Alliance name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Alliance name" placeholderTextColor="#475569" />

          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, s.textarea]} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor="#475569" multiline maxLength={500} />

          <Text style={s.label}>Region</Text>
          <TextInput style={s.input} value={region} onChangeText={setRegion} placeholder="e.g. Europe" placeholderTextColor="#475569" />

          <Text style={s.label}>Max members</Text>
          <TextInput style={s.input} value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" placeholder="50" placeholderTextColor="#475569" />

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Public alliance</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: '#334155', true: '#6366f1' }} thumbColor="#fff" />
          </View>
        </View>

        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={save} disabled={saving}>
          <Text style={s.btnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <Text style={s.dangerTitle}>Danger Zone</Text>
        <View style={[s.card, s.dangerCard]}>
          <TouchableOpacity style={s.btnDanger} onPress={deleteAlliance}>
            <Text style={s.btnDangerText}>Delete Alliance</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
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
  dangerCard: { borderWidth: 1, borderColor: '#7f1d1d' },
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 14, color: '#f1f5f9' },
  btn: { backgroundColor: '#6366f1', borderRadius: 10, padding: 15, alignItems: 'center', margin: 16, marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dangerTitle: { fontSize: 13, fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  btnDanger: { backgroundColor: '#450a0a', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#991b1b' },
  btnDangerText: { color: '#fca5a5', fontWeight: '700', fontSize: 15 },
});
