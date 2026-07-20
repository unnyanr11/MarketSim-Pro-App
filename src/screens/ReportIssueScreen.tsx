import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { reportIssue, IssueSeverity, IssueType } from '../api/maintenance';
import { useAuth } from '../context/AuthContext';

type RouteParams = {
  ReportIssue: {
    task_id: number;
    room_id: number;
    room_number: string;
  };
};

const ISSUE_TYPES: { key: IssueType; label: string; icon: string }[] = [
  { key: 'ELECTRICAL', label: 'Electrical', icon: 'flash' },
  { key: 'PLUMBING', label: 'Plumbing', icon: 'water' },
  { key: 'FURNITURE', label: 'Furniture', icon: 'bed' },
  { key: 'HVAC', label: 'AC / Heating', icon: 'thermometer' },
  { key: 'APPLIANCE', label: 'Appliance', icon: 'tv' },
  { key: 'CLEANLINESS', label: 'Cleanliness', icon: 'sparkles' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal' },
];

const SEVERITIES: {
  key: IssueSeverity;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
}[] = [
  {
    key: 'LOW',
    label: 'Minor',
    subtitle: 'Cosmetic — batched weekly',
    color: '#437a22',
    bg: '#edf6e7',
  },
  {
    key: 'MEDIUM',
    label: 'Moderate',
    subtitle: 'Same-day maintenance alert',
    color: '#d19900',
    bg: '#fdf8e3',
  },
  {
    key: 'HIGH',
    label: 'High',
    subtitle: 'Urgent — notify supervisor now',
    color: '#da7101',
    bg: '#fef3e7',
  },
  {
    key: 'CRITICAL',
    label: 'Critical',
    subtitle: 'Room blocked immediately',
    color: '#a12c7b',
    bg: '#fbe9f4',
  },
];

export default function ReportIssueScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'ReportIssue'>>();
  const { task_id, room_id, room_number } = route.params;
  const { user } = useAuth();

  const [issueType, setIssueType] = useState<IssueType>('OTHER');
  const [severity, setSeverity] = useState<IssueSeverity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [cannotComplete, setCannotComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedSeverity = SEVERITIES.find(s => s.key === severity)!;

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Missing description', 'Please describe the issue before submitting.');
      return;
    }

    const confirmMsg =
      severity === 'CRITICAL'
        ? `This will immediately block Room ${room_number} from new assignments and alert the manager. Continue?`
        : `Submit ${selectedSeverity.label.toLowerCase()} issue for Room ${room_number}?`;

    Alert.alert('Confirm Report', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        style: severity === 'CRITICAL' ? 'destructive' : 'default',
        onPress: async () => {
          setLoading(true);
          const result = await reportIssue({
            room_id,
            reported_by: user!.user_id,
            task_id,
            linked_task_id: task_id,
            issue_type: issueType,
            description: description.trim(),
            severity,
            cannot_complete: cannotComplete,
            photo_urls: [],
          });
          setLoading(false);

          if (!result) {
            Alert.alert('Error', 'Failed to submit issue. Please try again.');
            return;
          }

          const successMsg =
            severity === 'CRITICAL'
              ? `Issue reported. Room ${room_number} has been blocked and the manager has been notified.`
              : severity === 'HIGH'
              ? `Issue reported. Your supervisor will be notified shortly.`
              : `Issue logged for Room ${room_number}.`;

          Alert.alert('Issue Reported', successMsg, [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#28251d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Issue</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Room badge */}
        <View style={styles.roomBadge}>
          <Ionicons name="location" size={14} color="#01696f" />
          <Text style={styles.roomBadgeText}>Room {room_number}</Text>
        </View>

        {/* Issue Type */}
        <Text style={styles.sectionLabel}>What type of issue?</Text>
        <View style={styles.typeGrid}>
          {ISSUE_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeChip, issueType === t.key && styles.typeChipActive]}
              onPress={() => setIssueType(t.key)}
            >
              <Ionicons
                name={t.icon as any}
                size={18}
                color={issueType === t.key ? '#fff' : '#7a7974'}
              />
              <Text style={[styles.typeChipText, issueType === t.key && styles.typeChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Severity */}
        <Text style={styles.sectionLabel}>Severity</Text>
        {SEVERITIES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.severityRow,
              severity === s.key && { borderColor: s.color, backgroundColor: s.bg },
            ]}
            onPress={() => setSeverity(s.key)}
          >
            <View style={styles.severityLeft}>
              <View
                style={[
                  styles.radioOuter,
                  severity === s.key && { borderColor: s.color },
                ]}
              >
                {severity === s.key && (
                  <View style={[styles.radioInner, { backgroundColor: s.color }]} />
                )}
              </View>
              <View>
                <Text style={[styles.severityLabel, severity === s.key && { color: s.color }]}>
                  {s.label}
                </Text>
                <Text style={styles.severitySubtitle}>{s.subtitle}</Text>
              </View>
            </View>
            {s.key === 'CRITICAL' && (
              <Ionicons name="warning" size={18} color={s.color} />
            )}
          </TouchableOpacity>
        ))}

        {/* Description */}
        <Text style={styles.sectionLabel}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe the issue in detail…"
          placeholderTextColor="#bab9b4"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        {/* Cannot complete toggle */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setCannotComplete(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, cannotComplete && styles.checkboxChecked]}>
            {cannotComplete && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Cannot complete this task</Text>
            <Text style={styles.toggleSub}>
              Room will be marked as requiring maintenance before cleaning
            </Text>
          </View>
        </TouchableOpacity>

        {/* Critical warning banner */}
        {severity === 'CRITICAL' && (
          <View style={styles.criticalBanner}>
            <Ionicons name="alert-circle" size={18} color="#a12c7b" />
            <Text style={styles.criticalText}>
              Submitting will immediately set Room {room_number} to MAINTENANCE status — it will not be assignable to guests until resolved.
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: selectedSeverity.color },
            loading && { opacity: 0.6 },
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.submitText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f6f2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e6e0',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#28251d' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#cedcd8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 24,
  },
  roomBadgeText: { fontSize: 13, fontWeight: '600', color: '#01696f' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7a7974',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#dcd9d5',
    backgroundColor: '#fff',
  },
  typeChipActive: { backgroundColor: '#01696f', borderColor: '#01696f' },
  typeChipText: { fontSize: 13, fontWeight: '500', color: '#7a7974' },
  typeChipTextActive: { color: '#fff' },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#dcd9d5',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  severityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#dcd9d5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  severityLabel: { fontSize: 15, fontWeight: '600', color: '#28251d' },
  severitySubtitle: { fontSize: 12, color: '#7a7974', marginTop: 1 },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#dcd9d5',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#28251d',
    minHeight: 110,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#dcd9d5',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#dcd9d5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#01696f', borderColor: '#01696f' },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#28251d' },
  toggleSub: { fontSize: 12, color: '#7a7974', marginTop: 2 },
  criticalBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fbe9f4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0ced7',
  },
  criticalText: { flex: 1, fontSize: 13, color: '#a12c7b', lineHeight: 18 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
