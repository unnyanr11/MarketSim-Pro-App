/**
 * Register.tsx — React Native
 * 3-step signup matching the web RegisterForm exactly:
 *   Step 1: Account (email, password, confirm password + strength meter)
 *   Step 2: Company (display name, company name, region, bio)
 *   Step 3: Preferences (notification toggles + terms acceptance)
 *
 * Now uses authService.register() which handles the RLS session fix.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authService } from '../services/auth.service';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};
type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const REGIONS = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'EU', name: 'Europe', flag: '🇪🇺' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'OTHER', name: 'Other', flag: '🌍' },
];

const DRAFT_KEY = 'registrationFormDraft';

const STEPS = [
  { id: 1, title: 'Account', desc: 'Create your account' },
  { id: 2, title: 'Company', desc: 'Tell us about your business' },
  { id: 3, title: 'Preferences', desc: 'Customize your experience' },
];

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  companyName: string;
  region: string;
  bio: string;
  acceptTerms: boolean;
  acceptMarketing: boolean;
  emailNotifications: boolean;
  newDemands: boolean;
  priceChanges: boolean;
  messages: boolean;
}

const DEFAULT: FormData = {
  email: '', password: '', confirmPassword: '',
  displayName: '', companyName: '', region: '', bio: '',
  acceptTerms: false, acceptMarketing: false,
  emailNotifications: true, newDemands: true, priceChanges: true, messages: true,
};

function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 25;
  if (/[A-Z]/.test(pw)) s += 25;
  if (/[a-z]/.test(pw)) s += 25;
  if (/\d/.test(pw)) s += 15;
  if (/[@$!%*?&]/.test(pw)) s += 10;
  return Math.min(100, s);
}

function strengthLabel(s: number) {
  if (s < 30) return { text: 'Weak', color: '#ef4444' };
  if (s < 60) return { text: 'Fair', color: '#eab308' };
  if (s < 80) return { text: 'Good', color: '#3b82f6' };
  return { text: 'Strong', color: '#22c55e' };
}

function validateStep(step: number, d: FormData): Record<string, string> {
  const errs: Record<string, string> = {};
  if (step === 1) {
    if (!d.email || !/\S+@\S+\.\S+/.test(d.email)) errs.email = 'Enter a valid email address';
    if (!d.password || d.password.length < 8) errs.password = 'Password must be at least 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+/.test(d.password))
      errs.password = 'Include uppercase, lowercase, number and special character';
    if (d.password !== d.confirmPassword) errs.confirmPassword = "Passwords don't match";
  }
  if (step === 2) {
    if (!d.displayName || d.displayName.trim().length < 2) errs.displayName = 'Name must be at least 2 characters';
    if (!d.companyName || d.companyName.trim().length < 2) errs.companyName = 'Company name must be at least 2 characters';
    if (!d.region) errs.region = 'Please select a region';
  }
  if (step === 3) {
    if (!d.acceptTerms) errs.acceptTerms = 'You must accept the terms and conditions';
  }
  return errs;
}

export default function Register({ navigation }: Props) {
  const [form, setForm] = useState<FormData>(DEFAULT);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const set = useCallback(
    (key: keyof FormData, value: string | boolean) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  useEffect(() => {
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form)).catch(() => {});
  }, [form]);

  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<FormData>;
        setForm((prev) => ({ ...prev, ...parsed }));
      })
      .catch(() => {});
  }, []);

  const strength = passwordStrength(form.password);
  const strengthInfo = strengthLabel(strength);
  const progress = Math.round((step / STEPS.length) * 100);

  const goNext = () => {
    const errs = validateStep(step, form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(STEPS.length, s + 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goPrev = () => {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const onSubmit = async () => {
    const errs = validateStep(3, form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    setGlobalError('');
    try {
      await authService.register({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        companyName: form.companyName.trim(),
        region: form.region,
        bio: form.bio.trim(),
        preferences: {
          notificationSettings: {
            emailNotifications: form.emailNotifications,
            pushNotifications: true,
            newDemands: form.newDemands,
            priceChanges: form.priceChanges,
            messages: form.messages,
          },
        },
      });

      await AsyncStorage.removeItem(DRAFT_KEY);

      Alert.alert(
        'Account created! 🎉',
        'Please check your email for a confirmation link, then sign in.',
        [{ text: 'Sign In', onPress: () => navigation.replace('Login') }]
      );
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Registration failed. Please try again.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join the SimCompanies marketplace community</Text>

        {/* Progress */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Step {step} of {STEPS.length}</Text>
          <Text style={styles.progressText}>{progress}% complete</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>

        {/* Step chips */}
        <View style={styles.stepRow}>
          {STEPS.map((s) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <View key={s.id} style={[styles.stepChip, isActive && styles.stepChipActive, isDone && styles.stepChipDone]}>
                <View style={[styles.stepDot, isActive && styles.stepDotActive, isDone && styles.stepDotDone]}>
                  <Text style={styles.stepDotText}>{isDone ? '✓' : s.id}</Text>
                </View>
                <Text style={[styles.stepLabel, isActive && styles.stepLabelActive, isDone && styles.stepLabelDone]}>{s.title}</Text>
              </View>
            );
          })}
        </View>

        {!!globalError && (
          <View style={styles.errorBox}><Text style={styles.errorBoxText}>⚠ {globalError}</Text></View>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Email address *</Text>
              <TextInput style={[styles.input, errors.email ? styles.inputError : null]} placeholder="Enter your email" placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" value={form.email} onChangeText={(v) => set('email', v)} />
              {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.inputRow}>
                <TextInput style={[styles.inputFlex, errors.password ? styles.inputError : null]} placeholder="Create a strong password" placeholderTextColor="#9ca3af" secureTextEntry={!showPw} textContentType="newPassword" value={form.password} onChangeText={(v) => set('password', v)} />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw((p) => !p)}><Text style={styles.eyeText}>{showPw ? '🙈' : '👁'}</Text></TouchableOpacity>
              </View>
              {!!form.password && (
                <View style={styles.strengthWrap}>
                  <View style={styles.strengthTrack}><View style={[styles.strengthFill, { width: `${strength}%` as any, backgroundColor: strengthInfo.color }]} /></View>
                  <Text style={[styles.strengthText, { color: strengthInfo.color }]}>{strengthInfo.text}</Text>
                </View>
              )}
              {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Confirm password *</Text>
              <View style={styles.inputRow}>
                <TextInput style={[styles.inputFlex, errors.confirmPassword ? styles.inputError : null]} placeholder="Confirm your password" placeholderTextColor="#9ca3af" secureTextEntry={!showConfirm} textContentType="newPassword" value={form.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm((p) => !p)}><Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁'}</Text></TouchableOpacity>
              </View>
              {!!errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
            </View>
          </View>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Your name *</Text>
              <TextInput style={[styles.input, errors.displayName ? styles.inputError : null]} placeholder="John Doe" placeholderTextColor="#9ca3af" value={form.displayName} onChangeText={(v) => set('displayName', v)} />
              {!!errors.displayName && <Text style={styles.fieldError}>{errors.displayName}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Company name *</Text>
              <TextInput style={[styles.input, errors.companyName ? styles.inputError : null]} placeholder="Acme Corp" placeholderTextColor="#9ca3af" value={form.companyName} onChangeText={(v) => set('companyName', v)} />
              {!!errors.companyName && <Text style={styles.fieldError}>{errors.companyName}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Region *</Text>
              <TouchableOpacity style={[styles.input, styles.pickerBtn, errors.region ? styles.inputError : null]} onPress={() => setShowRegionPicker((p) => !p)}>
                <Text style={form.region ? styles.pickerValue : styles.pickerPlaceholder}>
                  {form.region ? `${REGIONS.find((r) => r.code === form.region)?.flag ?? ''} ${REGIONS.find((r) => r.code === form.region)?.name ?? form.region}` : 'Select your region'}
                </Text>
                <Text style={styles.chevron}>{showRegionPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showRegionPicker && (
                <View style={styles.dropdown}>
                  {REGIONS.map((r) => (
                    <TouchableOpacity key={r.code} style={[styles.dropdownItem, form.region === r.code && styles.dropdownItemSelected]} onPress={() => { set('region', r.code); setShowRegionPicker(false); }}>
                      <Text style={styles.dropdownItemText}>{r.flag}  {r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!!errors.region && <Text style={styles.fieldError}>{errors.region}</Text>}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Company bio (optional)</Text>
              <TextInput style={[styles.input, styles.textarea]} placeholder="Tell us about your company..." placeholderTextColor="#9ca3af" multiline maxLength={500} value={form.bio} onChangeText={(v) => set('bio', v)} />
              <Text style={styles.charCount}>{form.bio.length}/500 characters</Text>
            </View>
          </View>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            {([
              { key: 'emailNotifications', label: 'Email notifications' },
              { key: 'newDemands', label: 'New demands in your categories' },
              { key: 'priceChanges', label: 'Price changes and market updates' },
              { key: 'messages', label: 'New messages and replies' },
            ] as { key: keyof FormData; label: string }[]).map(({ key, label }) => (
              <View key={key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>{label}</Text>
                <Switch value={!!form[key]} onValueChange={(v) => set(key, v)} trackColor={{ false: '#d1d5db', true: '#3b82f6' }} thumbColor="#fff" />
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Terms &amp; Conditions</Text>
            <TouchableOpacity style={styles.checkRow} onPress={() => set('acceptTerms', !form.acceptTerms)} activeOpacity={0.7}>
              <View style={[styles.checkbox, form.acceptTerms && styles.checkboxChecked, errors.acceptTerms ? styles.checkboxError : null]}>
                {form.acceptTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>I agree to the <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text></Text>
            </TouchableOpacity>
            {!!errors.acceptTerms && <Text style={styles.fieldError}>{errors.acceptTerms}</Text>}
            <TouchableOpacity style={[styles.checkRow, { marginTop: 12 }]} onPress={() => set('acceptMarketing', !form.acceptMarketing)} activeOpacity={0.7}>
              <View style={[styles.checkbox, form.acceptMarketing && styles.checkboxChecked]}>
                {form.acceptMarketing && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>I’d like to receive marketing emails about new features and offers</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Nav */}
        <View style={styles.navRow}>
          {step > 1 ? (
            <TouchableOpacity style={styles.btnOutline} onPress={goPrev}><Text style={styles.btnOutlineText}>← Previous</Text></TouchableOpacity>
          ) : <View />}
          {step < STEPS.length ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={goNext}><Text style={styles.btnPrimaryText}>Next →</Text></TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btnPrimary, styles.btnSuccess, loading && styles.btnDisabled]} onPress={onSubmit} disabled={loading}>
              <Text style={styles.btnPrimaryText}>{loading ? 'Creating…' : 'Create account →'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign in here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: '#9ca3af' },
  progressTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: 6, backgroundColor: '#3b82f6', borderRadius: 99 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  stepChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  stepChipActive: { backgroundColor: '#dbeafe' },
  stepChipDone: { backgroundColor: '#dcfce7' },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#2563eb' },
  stepDotDone: { backgroundColor: '#16a34a' },
  stepDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  stepLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  stepLabelActive: { color: '#2563eb' },
  stepLabelDone: { color: '#16a34a' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorBoxText: { color: '#b91c1c', fontSize: 14 },
  stepContent: { marginBottom: 8 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  inputError: { borderColor: '#ef4444' },
  inputFlex: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eyeBtn: { padding: 10 },
  eyeText: { fontSize: 18 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden' },
  strengthFill: { height: 6, borderRadius: 99 },
  strengthText: { fontSize: 12, fontWeight: '600', minWidth: 44, textAlign: 'right' },
  fieldError: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerValue: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { fontSize: 15, color: '#9ca3af' },
  chevron: { color: '#6b7280', fontSize: 12 },
  dropdown: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, marginTop: 4, zIndex: 100, elevation: 4 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemSelected: { backgroundColor: '#eff6ff' },
  dropdownItemText: { fontSize: 15, color: '#111827' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'right' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  switchLabel: { fontSize: 14, color: '#374151', flex: 1, paddingRight: 12 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxError: { borderColor: '#ef4444' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  link: { color: '#2563eb' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 },
  btnPrimary: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 10 },
  btnSuccess: { backgroundColor: '#16a34a' },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnOutline: { borderWidth: 1.5, borderColor: '#d1d5db', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10 },
  btnOutlineText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: '#6b7280' },
  footerLink: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
