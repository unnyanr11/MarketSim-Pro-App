import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { supabase } from '../supabase/client';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

interface UserProfile {
  id: string;
  display_name?: string;
  company_name?: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  region?: string;
}

export default function ProfilePage() {
  const navigation = useNavigation<NavProp>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('UserProfile')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? '');
        setCompanyName(data.company_name ?? '');
        setBio(data.bio ?? '');
        setRegion(data.region ?? '');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('UserProfile')
      .update({ display_name: displayName, company_name: companyName, bio, region, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setProfile((p) => p ? { ...p, display_name: displayName, company_name: companyName, bio, region } : p);
    setEditing(false);
    Alert.alert('Saved', 'Profile updated.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => setEditing((e) => !e)}>
          <Text style={styles.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar placeholder */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.display_name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        {!editing && (
          <>
            <Text style={styles.name}>{profile?.display_name ?? 'Anonymous'}</Text>
            {profile?.company_name ? <Text style={styles.company}>{profile.company_name}</Text> : null}
            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            {profile?.region ? <Text style={styles.region}>📍 {profile.region}</Text> : null}
          </>
        )}
      </View>

      {editing && (
        <View style={styles.card}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholderTextColor="#64748b" />
          <Text style={styles.label}>Company Name</Text>
          <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholderTextColor="#64748b" />
          <Text style={styles.label}>Bio</Text>
          <TextInput style={[styles.input, { minHeight: 80 }]} value={bio} onChangeText={setBio} multiline placeholderTextColor="#64748b" />
          <Text style={styles.label}>Region</Text>
          <TextInput style={styles.input} value={region} onChangeText={setRegion} placeholderTextColor="#64748b" />
          <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, backgroundColor: '#1e293b' },
  back: { color: '#6366f1', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  editBtn: { color: '#6366f1', fontSize: 15, fontWeight: '600' },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  company: { fontSize: 14, color: '#6366f1', marginTop: 4 },
  bio: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  region: { fontSize: 13, color: '#64748b', marginTop: 6 },
  card: { backgroundColor: '#1e293b', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10, textTransform: 'uppercase' },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', borderWidth: 1, borderColor: '#334155' },
  btn: { backgroundColor: '#6366f1', borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '700' },
  logoutBtn: { margin: 12, marginTop: 24, borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutText: { color: '#fca5a5', fontWeight: '600', fontSize: 15 },
});
