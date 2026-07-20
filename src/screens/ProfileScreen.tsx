import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../api/client';

interface UserProfile {
  user_id: number;
  username: string;
  email?: string;
  full_name: string;
  phone?: string;
  salary?: number;
  shift?: string;
  role: string;
  is_active: boolean;
  assigned_floor?: number | null;   // ✅ ADDED
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Password change fields
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total_tasks: 0,
    completed_today: 0,
    in_progress: 0,
    pending: 0,
  });

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        loadProfile();
        loadStats();
      } else {
        setLoading(false);
        Alert.alert(
          'Not Logged In',
          'Please login to view your profile',
          [{ text: 'Go to Login', onPress: () => navigation.navigate('Login' as never) }]
        );
      }
    }
  }, [authLoading, user]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      if (!user) return;

      const userId = user.user_id;

      if (!userId) {
        // Fallback to cached auth data
        setProfile({
          user_id: 0,
          username: user.username ?? 'N/A',
          email: user.email ?? undefined,
          full_name: user.full_name ?? 'N/A',
          phone: user.phone ?? undefined,
          salary: user.salary ? Number(user.salary) : undefined,
          shift: user.shift_timing ?? undefined,
          role: user.role ?? 'HOUSEKEEPING',
          is_active: user.is_active !== false,
          assigned_floor: user.assigned_floor ?? null,  // ✅ from auth cache
        });
        return;
      }

      // ✅ assigned_floor is now included in the SELECT
      const { data, error } = await supabase
        .from('users')
        .select(`
          user_id,
          username,
          full_name,
          email,
          phone,
          role,
          shift_timing,
          salary,
          is_active,
          assigned_floor,
          last_login,
          created_at
        `)
        .eq('user_id', userId)
        .single();

      if (error) throw new Error(error.message);
      if (!data)  throw new Error('User profile not found in database');

      setProfile({
        user_id:        data.user_id,
        username:       data.username ?? 'N/A',
        email:          data.email ?? undefined,
        full_name:      data.full_name,
        phone:          data.phone ?? undefined,
        salary:         data.salary ? Number(data.salary) : undefined,
        shift:          data.shift_timing ?? undefined,
        role:           data.role,
        is_active:      data.is_active !== false,
        assigned_floor: data.assigned_floor ?? null,   // ✅ STORED
      });
    } catch (err: any) {
      // Graceful fallback to auth-context data
      if (user) {
        setProfile({
          user_id:        user.user_id ?? 0,
          username:       user.username ?? 'N/A',
          email:          user.email ?? undefined,
          full_name:      user.full_name ?? 'N/A',
          phone:          user.phone ?? undefined,
          salary:         user.salary ? Number(user.salary) : undefined,
          shift:          user.shift_timing ?? undefined,
          role:           user.role ?? 'HOUSEKEEPING',
          is_active:      user.is_active !== false,
          assigned_floor: user.assigned_floor ?? null,  // ✅ from auth cache
        });
        Alert.alert('Info', 'Using cached profile data');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      if (!user?.user_id) return;
      const { data, error } = await supabase
        .rpc('get_today_task_stats', { p_user_id: user.user_id });
      if (error) return;
      const s = data?.[0] ?? { total_tasks: 0, completed_today: 0, in_progress: 0, pending: 0 };
      setStats(s);
    } catch (_) {}
  };

  const handlePasswordChange = async () => {
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew     = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      Alert.alert('Error', 'Please fill in all password fields'); return;
    }
    if (trimmedNew !== trimmedConfirm) {
      Alert.alert('Error', 'New passwords do not match'); return;
    }
    if (trimmedNew.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters'); return;
    }
    if (trimmedCurrent === trimmedNew) {
      Alert.alert('Error', 'New password must be different from current password'); return;
    }

    Alert.alert(
      'Confirm Password Change',
      'Are you sure you want to change your password?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            try {
              setUpdating(true);
              if (!profile?.user_id) throw new Error('User ID not found. Please try logging in again.');

              const { data, error } = await supabase.rpc('change_user_password', {
                p_user_id:        profile.user_id,
                p_current_password: trimmedCurrent,
                p_new_password:   trimmedNew,
              });

              if (error)        throw new Error(error.message ?? 'Failed to communicate with server');
              if (!data)        throw new Error('No response from server');
              if (!data.success) throw new Error(data.error ?? 'Password change failed');

              Alert.alert(
                '✅ Success',
                'Your password has been changed successfully!',
                [{
                  text: 'OK',
                  onPress: () => {
                    setShowPasswordChange(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  },
                }]
              );
            } catch (err: any) {
              Alert.alert('❌ Error', err.message ?? 'Failed to change password. Please try again.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  // ─── Floor display helper ─────────────────────────────────────────────────
  const floorLabel = (floor: number | null | undefined): string => {
    if (floor === null || floor === undefined) return 'Not Assigned';
    if (floor === 0) return 'Ground Floor';
    const s = floor % 10;
    const suffix =
      floor === 11 || floor === 12 || floor === 13 ? 'th'
      : s === 1 ? 'st'
      : s === 2 ? 'nd'
      : s === 3 ? 'rd'
      : 'th';
    return `${floor}${suffix} Floor`;
  };

  // ─── Render guards ────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>
          {authLoading ? 'Initializing...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Not logged in</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.navigate('Login' as never)}>
          <Text style={styles.retryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      {/* Profile Header */}
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, !profile.is_active && styles.avatarInactive]}>
            <Text style={styles.avatarText}>
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          {!profile.is_active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactive</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.roleSubtitle}>@{profile.username}</Text>
      </View>

      {/* Today's Statistics */}
      {profile.role === 'HOUSEKEEPING' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Today's Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.completed_today}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.statInProgress]}>{stats.in_progress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.statPending]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>
      )}

      {/* Personal Information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 Personal Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Full Name</Text>
          <Text style={styles.infoValue}>{profile.full_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Username</Text>
          <Text style={styles.infoValue}>{profile.username}</Text>
        </View>

        {profile.email ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
        ) : null}

        {profile.phone ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile.phone}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{profile.role}</Text>
        </View>

        {/* ✅ ASSIGNED FLOOR — always shown for HOUSEKEEPING */}
        {profile.role === 'HOUSEKEEPING' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned Floor</Text>
            <View style={[
              styles.floorBadge,
              profile.assigned_floor !== null && profile.assigned_floor !== undefined
                ? styles.floorBadgeAssigned
                : styles.floorBadgeUnassigned,
            ]}>
              <Text style={styles.floorBadgeText}>
                {floorLabel(profile.assigned_floor)}
              </Text>
            </View>
          </View>
        )}

        {profile.shift ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shift</Text>
            <Text style={styles.infoValue}>{profile.shift}</Text>
          </View>
        ) : null}

        {profile.salary !== null && profile.salary !== undefined ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Salary</Text>
            <Text style={styles.infoValue}>
              ₹{Number(profile.salary).toLocaleString('en-IN')}
            </Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <View style={[styles.statusBadge, profile.is_active ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusText}>
              {profile.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Change Password */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowPasswordChange(!showPasswordChange)}
        >
          <Text style={styles.sectionTitle}>🔒 Change Password</Text>
          <Text style={styles.toggleIcon}>{showPasswordChange ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {showPasswordChange && (
          <View style={styles.passwordForm}>
            <Text style={styles.passwordHint}>Password must be at least 6 characters long</Text>

            <TextInput
              style={styles.input}
              placeholder="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#95a5a6"
              editable={!updating}
            />
            <TextInput
              style={styles.input}
              placeholder="New Password (min 6 characters)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#95a5a6"
              editable={!updating}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#95a5a6"
              editable={!updating}
            />

            <TouchableOpacity
              style={[styles.changePasswordButton, updating && styles.buttonDisabled]}
              onPress={handlePasswordChange}
              disabled={updating}
            >
              {updating ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.changePasswordButtonText, { marginLeft: 8 }]}>Updating...</Text>
                </View>
              ) : (
                <Text style={styles.changePasswordButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>🚪 Logout</Text>
      </TouchableOpacity>

      <View style={styles.noteContainer}>
        <Text style={styles.noteText}>
          ℹ️ To update your personal information, please contact your administrator.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f3f7ff', paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f7ff' },
  loadingText:        { marginTop: 12, fontSize: 16, color: '#7f8c8d' },
  errorContainer:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f7ff', padding: 20 },
  errorText:          { fontSize: 16, color: '#e74c3c', marginBottom: 20 },
  retryButton:        { backgroundColor: '#3498db', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText:    { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  title:              { fontSize: 28, fontWeight: '700', marginBottom: 20, color: '#2c3e50' },
  card:               { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  avatarContainer:    { alignItems: 'center', marginBottom: 12, position: 'relative' },
  avatar:             { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center' },
  avatarInactive:     { backgroundColor: '#95a5a6' },
  avatarText:         { color: 'white', fontWeight: '700', fontSize: 36 },
  inactiveBadge:      { position: 'absolute', bottom: 0, backgroundColor: '#e74c3c', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  inactiveBadgeText:  { color: 'white', fontSize: 10, fontWeight: 'bold' },
  name:               { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#2c3e50' },
  roleSubtitle:       { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginTop: 4 },
  sectionTitle:       { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#2c3e50' },
  statsRow:           { flexDirection: 'row', justifyContent: 'space-around' },
  statItem:           { alignItems: 'center' },
  statNumber:         { fontSize: 28, fontWeight: '700', color: '#27ae60' },
  statInProgress:     { color: '#f39c12' },
  statPending:        { color: '#95a5a6' },
  statLabel:          { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  infoRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ecf0f1' },
  infoLabel:          { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  infoValue:          { fontSize: 14, color: '#2c3e50', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  // ✅ Floor badge styles
  floorBadge:         { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  floorBadgeAssigned: { backgroundColor: '#d5eaff' },
  floorBadgeUnassigned: { backgroundColor: '#fde8e8' },
  floorBadgeText:     { fontSize: 13, fontWeight: '700', color: '#2c3e50' },
  statusBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusActive:       { backgroundColor: '#d5f4e6' },
  statusInactive:     { backgroundColor: '#fadbd8' },
  statusText:         { fontSize: 12, fontWeight: '600', color: '#2c3e50' },
  passwordToggle:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleIcon:         { fontSize: 16, color: '#7f8c8d' },
  passwordForm:       { marginTop: 16 },
  passwordHint:       { fontSize: 13, color: '#7f8c8d', marginBottom: 12, fontStyle: 'italic' },
  input:              { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, color: '#2c3e50' },
  changePasswordButton: { backgroundColor: '#3498db', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled:     { backgroundColor: '#95a5a6' },
  changePasswordButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonContent:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoutButton:       { backgroundColor: '#e74c3c', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  logoutButtonText:   { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  noteContainer:      { backgroundColor: '#e3f2fd', borderRadius: 8, padding: 16, marginBottom: 30 },
  noteText:           { fontSize: 13, color: '#1565c0', lineHeight: 20 },
});

export default ProfileScreen;
