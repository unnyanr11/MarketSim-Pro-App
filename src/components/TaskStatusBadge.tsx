import React from "react";
import { Text, StyleSheet } from "react-native";
import { TaskStatus } from "../types/Task";

const statusColor: Record<TaskStatus, string> = {
  PENDING: "#f39c12",
  IN_PROGRESS: "#3498db",
  CLEANED: "#27ae60",
  DELAYED: "#e74c3c",
  MAINTENANCE_HOLD: "#8e44ad",
};

const statusLabel: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  CLEANED: "Cleaned",
  DELAYED: "Delayed",
  MAINTENANCE_HOLD: "Maint. Hold",
};

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status }) => (
  <Text style={[styles.badge, { backgroundColor: statusColor[status] ?? "#95a5a6" }]}>
    {statusLabel[status] ?? status}
  </Text>
);

const styles = StyleSheet.create({
  badge: {
    color: "white",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: "600",
    overflow: "hidden",
    textTransform: "uppercase",
  },
});

export default TaskStatusBadge;
