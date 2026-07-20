import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../hooks/useAuth';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { login, isLoading: authLoading, error: authError } = useAuth();

  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isBusy = submitting || authLoading;

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Validation', 'Username is required.');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Validation', 'Password must be at least 4 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await login(username.trim(), password);
      if (ok) {
        navigation.replace('Home');
      }
      // If !ok, authError is already set in useAuth — shown inline below
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={S.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={S.inner}>
        {/* Logo */}
        <View style={S.logoContainer}>
          <View style={S.logoCircle}>
            <Text style={S.logo}>🏨</Text>
          </View>
          <Text style={S.appName}>HMS Housekeeping</Text>
          <Text style={S.appSubtitle}>Staff Portal</Text>
        </View>

        {/* Title */}
        <View style={S.welcomeContainer}>
          <Text style={S.title}>Welcome Back</Text>
          <Text style={S.subtitle}>Sign in to manage your cleaning tasks</Text>
        </View>

        {/* Inline error from RPC (shows lock message, wrong-password, etc.) */}
        {authError ? (
          <View style={S.errorBox}>
            <Text style={S.errorText}>⚠️  {authError}</Text>
          </View>
        ) : null}

        {/* Inputs */}
        <View style={S.inputContainer}>
          <View style={S.inputWrapper}>
            <Text style={S.inputLabel}>Username</Text>
            <TextInput
              style={S.input}
              placeholder="Enter your username"
              placeholderTextColor="#95a5a6"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              editable={!isBusy}
            />
          </View>

          <View style={S.inputWrapper}>
            <Text style={S.inputLabel}>Password</Text>
            <View style={S.passwordContainer}>
              <TextInput
                style={[S.input, S.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor="#95a5a6"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                editable={!isBusy}
              />
              <TouchableOpacity
                style={S.eyeIcon}
                onPress={() => setShowPassword(p => !p)}
                disabled={isBusy}
              >
                <Text style={S.eyeIconText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Login button */}
        <TouchableOpacity
          style={[S.loginButton, isBusy && S.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isBusy}
        >
          {isBusy
            ? <ActivityIndicator color="white" />
            : <Text style={S.loginButtonText}>Login</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={S.footer}>Powered by Hotel Management System</Text>
    </KeyboardAvoidingView>
  );
};

const S = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#f3f7ff', justifyContent: 'space-between' },
  inner:               { padding: 24, paddingTop: 60 },
  logoContainer:       { alignItems: 'center', marginBottom: 40 },
  logoCircle:          { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#3498db', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  logo:                { fontSize: 50 },
  appName:             { fontSize: 24, fontWeight: '700', color: '#2c3e50', marginBottom: 4 },
  appSubtitle:         { fontSize: 14, color: '#7f8c8d', fontWeight: '600' },
  welcomeContainer:    { marginBottom: 20 },
  title:               { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: '#2c3e50' },
  subtitle:            { fontSize: 14, textAlign: 'center', color: '#7f8c8d', lineHeight: 20 },
  errorBox:            { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:           { color: '#b91c1c', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  inputContainer:      { marginBottom: 16 },
  inputWrapper:        { marginBottom: 16 },
  inputLabel:          { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 8, marginLeft: 4 },
  input:               { backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#e1e8ed', fontSize: 16, color: '#2c3e50' },
  passwordContainer:   { position: 'relative' },
  passwordInput:       { paddingRight: 50 },
  eyeIcon:             { position: 'absolute', right: 12, top: 12, padding: 4 },
  eyeIconText:         { fontSize: 20 },
  loginButton:         { backgroundColor: '#3498db', borderRadius: 12, paddingVertical: 16, alignItems: 'center', shadowColor: '#3498db', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText:     { color: 'white', fontSize: 16, fontWeight: '700' },
  footer:              { textAlign: 'center', color: '#95a5a6', marginBottom: 20, fontSize: 12 },
});

export default LoginScreen;
