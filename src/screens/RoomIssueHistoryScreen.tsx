import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getRoomIssueHistory, MaintenanceIssue } from '../api/maintenance';

type RouteParams = {
  RoomIssueHistory: { room_id: number; room_number: string };
};

const SEVERITY_META: Record<string, { color: string; bg: string; label: string }> = {
  LOW: { color: '#437a22', bg: '#edf6e7', label: 'Minor' },
  MEDIUM: { color: '#d19900', bg: '#fdf8e3', label: 'Moderate' },
  HIGH: { color: '#da7101', bg: '#fef3e7', label: 'High' },
  CRITICAL: { color: '#a12c7b', bg: '#fbe9f4', label: 'Critical' },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  OPEN: { color: '#a12c7b', label: 'Open' },
  IN_PROGRESS: { color: '#d19900', label: 'In Progress' },
  RESOLVED: { color: '#437a22', label: 'Resolved' },
  CLOSED: { color: '#7a7974', label: 'Closed' },
};

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RoomIssueHistoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'RoomIssueHistory'>>();
  const { room_id, room_number } = route.params;

  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRoomIssueHistory(room_id).then(data => {
      setIssues(data);
      setLoading(false);
    });
  }, [room_id]);

  function renderIssue({ item }: { item: MaintenanceIssue }) {
    const sev = SEVERITY_META[item.severity] ?? SEVERITY_META.MEDIUM;
    const st = STATUS_META[item.status] ?? STATUS_META.OPEN;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
              <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
            </View>
            <Text style={styles.issueType}>
              {item.issue_type.charAt(0) + item.issue_type.slice(1).toLowerCase()}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
        </View>

        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          {item.reporter_name ? (
            <Text style={styles.metaText}>by {item.reporter_name}</Text>
          ) : null}
          <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
        </View>

        {item.cannot_complete && (
          <View style={styles.cannotRow}>
            <Ionicons name="close-circle" size={13} color="#a12c7b" />
            <Text style={styles.cannotText}>Could not complete task</Text>
          </View>
        )}
        {item.room_blocked && (
          <View style={styles.blockedRow}>
            <Ionicons name="lock-closed" size={13} color="#da7101" />
            <Text style={styles.blockedText}>Room was blocked</Text>
          </View>
        )}
        {item.resolved_at && item.resolution_notes ? (
          <View style={styles.resolutionRow}>
            <Ionicons name="checkmark-circle" size={13} color="#437a22" />
            <Text style={styles.resolutionText} numberOfLines={2}>{item.resolution_notes}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#28251d" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Room {room_number}</Text>
          <Text style={styles.headerSub}>Maintenance History</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#01696f" />
        </View>
      ) : issues.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#bab9b4" />
          <Text style={styles.emptyTitle}>No issues reported</Text>
          <Text style={styles.emptySub}>This room has a clean maintenance record</Text>
        </View>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={i => String(i.issue_id)}
          renderItem={renderIssue}
          contentContainerStyle={styles.list}
        />
      )}
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#28251d', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#7a7974', textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8e6e0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sevBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  sevText: { fontSize: 12, fontWeight: '700' },
  issueType: { fontSize: 14, fontWeight: '600', color: '#28251d' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  description: { fontSize: 14, color: '#28251d', lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#7a7974' },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  cannotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cannotText: { fontSize: 12, color: '#a12c7b' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  blockedText: { fontSize: 12, color: '#da7101' },
  resolutionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 8 },
  resolutionText: { flex: 1, fontSize: 12, color: '#437a22', lineHeight: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#28251d' },
  emptySub: { fontSize: 13, color: '#7a7974' },
});
