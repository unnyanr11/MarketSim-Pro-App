/**
 * Login.tsx — React Native
 *
 * ROOT CAUSE FIX for "unable to login":
 * The previous version called navigation.replace('Dashboard') after a
 * successful sign-in. However, App.tsx uses a CONDITIONAL navigator —
 * unauthenticated users only see Login/Register screens, so 'Dashboard'
 * does not exist in the navigator at that point. Calling replace() on a
 * non-existent route causes a silent failure that looks like login is broken.
 *
 * The correct pattern (used here):
 *   1. Call authService.login() — which calls supabase.auth.signInWithPassword
 *   2. Do nothing else — Supabase fires onAuthStateChange in App.tsx
 *   3. App.tsx sets session → navigator re-renders → Dashboard appears automatically
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authService } from '../services/auth.service';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginPage({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await authService.login(email.trim(), password);
      // ✅ Do NOT call navigation.replace() here.
      // App.tsx onAuthStateChange fires, sets session, and the
      // navigator automatically switches to the authenticated stack.
    } catch (err: any) {
      const msg: string = err?.message ?? 'Login failed';
      if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('verif')) {
        setError(
          'Please confirm your email first. Check your inbox for a verification link from Supabase.'
        );
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError(
          'Incorrect email or password. Try again or use "Forgot password" to reset it.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setForgotSent(false);
    if (!email.trim()) {
      setError('Enter your email above, then tap "Forgot password".');
      return;
    }
    try {
      await authService.resetPassword(email.trim());
      setForgotSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send reset email.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>MarketSim Pro</Text>
        <Text style={styles.tagline}>The Trading Simulation Marketplace</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠  {error}</Text>
          </View>
        )}

        {forgotSent && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✉  Password reset email sent! Check your inbox.</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <View style={styles.pwRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            secureTextEntry={!showPassword}
            textContentType="password"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((p) => !p)}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.linkText}>
            Don't have an account?{' '}
            <Text style={styles.linkHighlight}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { fontSize: 32, fontWeight: '800', color: '#6366f1', textAlign: 'center', marginBottom: 6 },
  tagline: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 32 },
  errorBox: {
    backgroundColor: '#450a0a', borderColor: '#991b1b', borderWidth: 1,
    borderRadius: 8, padding: 12, marginBottom: 14,
  },
  errorText: { color: '#fca5a5', fontSize: 13, lineHeight: 18 },
  successBox: {
    backgroundColor: '#052e16', borderColor: '#166534', borderWidth: 1,
    borderRadius: 8, padding: 12, marginBottom: 14,
  },
  successText: { color: '#86efac', fontSize: 13 },
  input: {
    backgroundColor: '#1e293b', borderRadius: 10, padding: 14,
    color: '#f1f5f9', fontSize: 15, marginBottom: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  inputFlex: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 14,
    color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155',
  },
  eyeBtn: { padding: 12 },
  eyeText: { fontSize: 18 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 18, marginTop: 4 },
  forgotText: { color: '#6366f1', fontSize: 13 },
  btn: {
    backgroundColor: '#6366f1', borderRadius: 10, padding: 15,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#64748b', fontSize: 14 },
  linkHighlight: { color: '#6366f1', fontWeight: '600' },
});
