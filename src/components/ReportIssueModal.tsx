import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { supabase } from "../api/client";
import { showInstantNotification } from "../services/notifications";
import { IssueType, IssueSeverity, CreateIssueInput } from "../types/Task";

// ─── Config ──────────────────────────────────────────────────────────────────

const ISSUE_TYPES: { value: IssueType; label: string; icon: string }[] = [
  { value: "ELECTRICAL", label: "Electrical", icon: "⚡" },
  { value: "PLUMBING", label: "Plumbing", icon: "🚿" },
  { value: "FURNITURE", label: "Furniture", icon: "🪑" },
  { value: "HVAC", label: "AC / Heating", icon: "❄️" },
  { value: "APPLIANCE", label: "Appliance", icon: "📺" },
  { value: "CLEANLINESS", label: "Cleanliness", icon: "🧹" },
  { value: "OTHER", label: "Other", icon: "🔧" },
];

const SEVERITY_OPTIONS: {
  value: IssueSeverity;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
}[] = [
  {
    value: "LOW",
    label: "Minor",
    sublabel: "Logged for weekly round",
    color: "#27ae60",
    bg: "#eafaf1",
  },
  {
    value: "MEDIUM",
    label: "Moderate",
    sublabel: "Same-day maintenance alert",
    color: "#f39c12",
    bg: "#fef9e7",
  },
  {
    value: "HIGH",
    label: "Serious",
    sublabel: "Same-day maintenance alert",
    color: "#e67e22",
    bg: "#fdf2e9",
  },
  {
    value: "CRITICAL",
    label: "Urgent",
    sublabel: "Room blocked + manager notified",
    color: "#e74c3c",
    bg: "#fdedec",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: number;
  roomNumber: string;
  taskId: number;
  reportedBy: number;
  /** Called after a successful submission so the parent can refresh the task */
  onSubmitted: (cannotComplete: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReportIssueModal: React.FC<Props> = ({
  visible,
  onClose,
  roomId,
  roomNumber,
  taskId,
  reportedBy,
  onSubmitted,
}) => {
  const [issueType, setIssueType] = useState<IssueType>("PLUMBING");
  const [severity, setSeverity] = useState<IssueSeverity>("MEDIUM");
  const [description, setDescription] = useState("");
  const [cannotComplete, setCannotComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedSeverityMeta = SEVERITY_OPTIONS.find((s) => s.value === severity)!;

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Description required", "Please describe the issue before submitting.");
      return;
    }

    setLoading(true);
    try {
      const isCritical = severity === "CRITICAL";
      const isHighOrAbove = severity === "HIGH" || severity === "CRITICAL";

      const issuePayload: CreateIssueInput = {
        room_id: roomId,
        reported_by: reportedBy,
        task_id: taskId,
        linked_task_id: taskId,
        issue_type: issueType,
        description: description.trim(),
        severity,
        cannot_complete: cannotComplete || isCritical,
        photo_urls: [],
        room_blocked: isCritical,
      } as any;

      // 1. Insert the issue
      const { data: issueData, error: issueError } = await supabase
        .from("maintenance_issues")
        .insert(issuePayload)
        .select("issue_id")
        .single();

      if (issueError) throw issueError;

      // 2. If cannot complete (or CRITICAL), set task to MAINTENANCE_HOLD
      if (cannotComplete || isCritical) {
        await supabase
          .from("housekeeping_tasks")
          .update({ status: "MAINTENANCE_HOLD", updated_at: new Date().toISOString() })
          .eq("task_id", taskId);
      }

      // 3. CRITICAL → block room from new guest assignments
      if (isCritical) {
        await supabase
          .from("rooms")
          .update({ status: "MAINTENANCE", updated_at: new Date().toISOString() })
          .eq("room_id", roomId);
      }

      // 4. Notifications based on severity
      if (isCritical) {
        await showInstantNotification({
          title: `🚨 Urgent Issue — Room ${roomNumber}`,
          body: `${ISSUE_TYPES.find((t) => t.value === issueType)?.label}: ${description.trim()}. Room blocked from new assignments.`,
          data: { type: "MAINTENANCE_CRITICAL", room_id: roomId, issue_id: issueData.issue_id },
        });
      } else if (isHighOrAbove) {
        await showInstantNotification({
          title: `⚠️ Maintenance Required — Room ${roomNumber}`,
          body: `${ISSUE_TYPES.find((t) => t.value === issueType)?.label}: ${description.trim()}`,
          data: { type: "MAINTENANCE_HIGH", room_id: roomId, issue_id: issueData.issue_id },
        });
      }

      // 5. Reset form
      setDescription("");
      setIssueType("PLUMBING");
      setSeverity("MEDIUM");
      setCannotComplete(false);

      onSubmitted(cannotComplete || isCritical);
      onClose();

      Alert.alert(
        "Issue Reported",
        isCritical
          ? `Room ${roomNumber} has been blocked and the manager has been notified.`
          : isHighOrAbove
          ? "Maintenance has been notified for same-day attention."
          : "Issue logged and will be included in the next maintenance round.",
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to submit the issue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Report Issue</Text>
            <Text style={styles.headerSubtitle}>Room {roomNumber}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Issue Type */}
          <Text style={styles.sectionLabel}>Issue Type</Text>
          <View style={styles.chipRow}>
            {ISSUE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, issueType === t.value && styles.chipSelected]}
                onPress={() => setIssueType(t.value)}
              >
                <Text style={styles.chipIcon}>{t.icon}</Text>
                <Text style={[styles.chipLabel, issueType === t.value && styles.chipLabelSelected]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Severity */}
          <Text style={styles.sectionLabel}>Severity</Text>
          <View style={styles.severityList}>
            {SEVERITY_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[
                  styles.severityRow,
                  severity === s.value && { backgroundColor: s.bg, borderColor: s.color },
                ]}
                onPress={() => setSeverity(s.value)}
              >
                <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                <View style={styles.severityText}>
                  <Text style={[styles.severityLabel, severity === s.value && { color: s.color }]}>
                    {s.label}
                  </Text>
                  <Text style={styles.severitySublabel}>{s.sublabel}</Text>
                </View>
                <View style={[styles.radio, severity === s.value && { borderColor: s.color }]}>
                  {severity === s.value && <View style={[styles.radioDot, { backgroundColor: s.color }]} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* CRITICAL warning banner */}
          {severity === "CRITICAL" && (
            <View style={styles.criticalBanner}>
              <Text style={styles.criticalBannerText}>
                🚨 This room will be automatically blocked from new guest assignments and the manager will be notified immediately.
              </Text>
            </View>
          )}

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the issue clearly — what you saw, where exactly, any relevant context..."
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />

          {/* Cannot complete toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Cannot complete this room</Text>
              <Text style={styles.toggleSubtitle}>
                Task will be held — room can still be marked once maintenance resolves the issue
              </Text>
            </View>
            <Switch
              value={cannotComplete || severity === "CRITICAL"}
              onValueChange={setCannotComplete}
              disabled={severity === "CRITICAL"}
              trackColor={{ false: "#ddd", true: "#8e44ad" }}
              thumbColor="white"
            />
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: selectedSeverityMeta.color },
              loading && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {cannotComplete || severity === "CRITICAL"
                  ? "Report & Hold Room"
                  : "Submit Report"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#7f8c8d",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 14,
    color: "#555",
    fontWeight: "600",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 20,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
    gap: 5,
  },
  chipSelected: {
    borderColor: "#1a1a2e",
    backgroundColor: "#1a1a2e",
  },
  chipIcon: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  chipLabelSelected: {
    color: "white",
  },
  severityList: {
    gap: 8,
  },
  severityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
    gap: 12,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  severityText: {
    flex: 1,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
  },
  severitySublabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  criticalBanner: {
    backgroundColor: "#fdedec",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  criticalBannerText: {
    fontSize: 13,
    color: "#922b21",
    lineHeight: 19,
  },
  textArea: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    padding: 14,
    fontSize: 14,
    color: "#2c3e50",
    minHeight: 110,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
  },
  toggleSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 3,
    lineHeight: 16,
  },
  bottomPad: {
    height: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default ReportIssueModal;
