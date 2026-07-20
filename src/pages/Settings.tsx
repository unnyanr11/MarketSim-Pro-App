/**
 * Settings.tsx — Account settings: profile edit, password change,
 * notification prefs, danger zone (logout / delete)
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import { authService } from '../services/auth.service';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function Settings({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newDemands, setNewDemands] = useState(true);
  const [priceChanges, setPriceChanges] = useState(true);
  const [messages, setMessages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('UserProfile').select('*').eq('user_id', user.id).single();
      if (data) {
        setDisplayName(data.display_name ?? '');
        setCompanyName(data.company_name ?? '');
        setBio(data.bio ?? '');
        setEmailNotifications(data.preferences?.notificationSettings?.emailNotifications ?? true);
        setNewDemands(data.preferences?.notificationSettings?.newDemands ?? true);
        setPriceChanges(data.preferences?.notificationSettings?.priceChanges ?? true);
        setMessages(data.preferences?.notificationSettings?.messages ?? true);
      }
    })();
  }, []);

  const saveProfile = async () => {
    if (!displayName.trim() || !companyName.trim()) {
      Alert.alert('Error', 'Name and company name are required.');
      return;
    }
    setSaving(true);
    try {
      await supabase.from('UserProfile').update({
        display_name: displayName.trim(),
        company_name: companyName.trim(),
        bio: bio.trim(),
        preferences: {
          notificationSettings: { emailNotifications, newDemands, priceChanges, messages },
        },
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', "Passwords don't match.");
      return;
    }
    try {
      await authService.changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const logout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await authService.logout(); } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Settings</Text>
        </View>

        {saved && <View style={s.savedBanner}><Text style={s.savedText}>✓ Changes saved</Text></View>}

        {/* Profile */}
        <Text style={s.sectionTitle}>Profile</Text>
        <View style={s.card}>
          <Text style={s.label}>Display name *</Text>
          <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor="#475569" />
          <Text style={s.label}>Company name *</Text>
          <TextInput style={s.input} value={companyName} onChangeText={setCompanyName} placeholder="Company" placeholderTextColor="#475569" />
          <Text style={s.label}>Bio</Text>
          <TextInput style={[s.input, s.textarea]} value={bio} onChangeText={setBio} placeholder="Tell us about your company..." placeholderTextColor="#475569" multiline maxLength={500} />
        </View>

        {/* Notifications */}
        <Text style={s.sectionTitle}>Notifications</Text>
        <View style={s.card}>
          {[
            { label: 'Email notifications', value: emailNotifications, setter: setEmailNotifications },
            { label: 'New demands', value: newDemands, setter: setNewDemands },
            { label: 'Price changes', value: priceChanges, setter: setPriceChanges },
            { label: 'Messages', value: messages, setter: setMessages },
          ].map(({ label, value, setter }) => (
            <View key={label} style={s.switchRow}>
              <Text style={s.switchLabel}>{label}</Text>
              <Switch value={value} onValueChange={setter} trackColor={{ false: '#334155', true: '#6366f1' }} thumbColor="#fff" />
            </View>
          ))}
        </View>

        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={saveProfile} disabled={saving}>
          <Text style={s.btnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {/* Password */}
        <Text style={s.sectionTitle}>Change Password</Text>
        <View style={s.card}>
          <Text style={s.label}>New password</Text>
          <TextInput style={s.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#475569" secureTextEntry />
          <Text style={s.label}>Confirm new password</Text>
          <TextInput style={s.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor="#475569" secureTextEntry />
          <TouchableOpacity style={s.btnOutline} onPress={changePassword}>
            <Text style={s.btnOutlineText}>Update Password</Text>
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <Text style={s.sectionTitle}>Account</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.btnDanger} onPress={logout}>
            <Text style={s.btnDangerText}>Sign Out</Text>
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
  content: { paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 8 },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  savedBanner: { backgroundColor: '#052e16', borderColor: '#166534', borderWidth: 1, borderRadius: 8, padding: 10, marginHorizontal: 16, marginBottom: 8 },
  savedText: { color: '#86efac', fontWeight: '600', textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginHorizontal: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  switchLabel: { fontSize: 14, color: '#f1f5f9' },
  btn: { backgroundColor: '#6366f1', borderRadius: 10, padding: 14, alignItems: 'center', margin: 16, marginTop: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnOutline: { borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  btnOutlineText: { color: '#6366f1', fontWeight: '700' },
  btnDanger: { backgroundColor: '#450a0a', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#991b1b' },
  btnDangerText: { color: '#fca5a5', fontWeight: '700', fontSize: 15 },
});
