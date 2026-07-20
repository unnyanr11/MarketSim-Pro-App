/**
 * UserProfile.tsx — Public profile of another user
 * Matches web MarketSim-Pro UserProfile:
 *  - displayName, companyName, region, bio
 *  - Follow / Unfollow with follower count
 *  - Rate (star + comment)
 *  - Report (reason + details)
 *  - Message button → navigate to Messages with recipientId param
 *
 * DB tables (matching web): user_profiles, follows, ratings, reports, messages
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabase/client';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

interface PublicProfile {
  user_id: string;
  display_name: string;
  company_name: string;
  region: string;
  bio: string;
}

interface FollowCounts { followers: number; following: number; }
interface RatingSummary { average: number; total: number; }

const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Fraud',
  'Fake account',
  'Inappropriate content',
  'Other',
];

const StarRow = ({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) => (
  <View style={sr.row}>
    {[1, 2, 3, 4, 5].map(n => (
      <TouchableOpacity key={n} disabled={readonly} onPress={() => onChange?.(n)}>
        <Text style={[sr.star, n <= value ? sr.starFilled : sr.starEmpty]}>★</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default function UserProfile({ route, navigation }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  // Follow
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Rating
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateStars, setRateStars] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [rateLoading, setRateLoading] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  // Report
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const isSelf = currentUserId === userId;
  const canInteract = !!currentUserId && !isSelf;

  const loadSocialData = useCallback(async () => {
    const [{ count: followers }, { count: following }, { data: isF }, { data: rs }, { data: rated }] = await Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
      currentUserId
        ? supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('ratings').select('stars').eq('reviewee_id', userId),
      currentUserId
        ? supabase.from('ratings').select('id').eq('reviewer_id', currentUserId).eq('reviewee_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setFollowCounts({ followers: followers ?? 0, following: following ?? 0 });
    setIsFollowing(!!isF);
    if (rs && (rs as any[]).length > 0) {
      const arr = rs as any[];
      const avg = arr.reduce((s: number, r: any) => s + r.stars, 0) / arr.length;
      setRatingSummary({ average: Math.round(avg * 10) / 10, total: arr.length });
    }
    setHasRated(!!rated);
  }, [userId, currentUserId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, company_name, region, bio')
        .eq('user_id', userId)
        .single();
      setProfile(data as PublicProfile ?? null);
      setLoading(false);
    })();
  }, [userId]);

  useEffect(() => { if (!loading) loadSocialData(); }, [loading, loadSocialData]);

  const handleFollow = async () => {
    if (!canInteract) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', userId);
        setIsFollowing(false);
        setFollowCounts(p => ({ ...p, followers: p.followers - 1 }));
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId });
        setIsFollowing(true);
        setFollowCounts(p => ({ ...p, followers: p.followers + 1 }));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleRate = async () => {
    if (!canInteract) return;
    setRateLoading(true);
    try {
      await supabase.from('ratings').insert({
        reviewer_id: currentUserId,
        reviewee_id: userId,
        stars: rateStars,
        comment: rateComment.trim() || null,
      });
      setHasRated(true);
      setShowRateModal(false);
      setRateComment('');
      Alert.alert('Thanks!', 'Your rating was submitted.');
      loadSocialData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRateLoading(false);
    }
  };

  const handleReport = async () => {
    if (!canInteract || !reportReason) return;
    setReportLoading(true);
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUserId,
        target_type: 'user',
        target_id: userId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
      Alert.alert('Reported', 'Our team will review it shortly.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <>
      <ScrollView style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Public Profile</Text>
          <View style={s.publicBadge}><Text style={s.publicBadgeText}>Public</Text></View>
        </View>

        <View style={s.card}>
          {!profile ? (
            <Text style={s.notFound}>Profile not found</Text>
          ) : (
            <>
              {/* Identity */}
              <View style={s.avatarRow}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{profile.display_name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={s.identity}>
                  <Text style={s.displayName}>{profile.display_name}</Text>
                  {!!profile.company_name && <Text style={s.meta}>🏢 {profile.company_name}</Text>}
                  {!!profile.region && <Text style={s.meta}>🌍 {profile.region}</Text>}
                </View>
              </View>

              {/* Follow counts + rating */}
              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={s.statVal}>{followCounts.followers}</Text>
                  <Text style={s.statLbl}>Followers</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statVal}>{followCounts.following}</Text>
                  <Text style={s.statLbl}>Following</Text>
                </View>
                {ratingSummary && ratingSummary.total > 0 && (
                  <View style={s.stat}>
                    <Text style={s.statVal}>⭐ {ratingSummary.average}</Text>
                    <Text style={s.statLbl}>{ratingSummary.total} reviews</Text>
                  </View>
                )}
              </View>

              {/* Bio */}
              {!!profile.bio && (
                <View style={s.bioSection}>
                  <Text style={s.bioTitle}>About</Text>
                  <Text style={s.bioText}>{profile.bio}</Text>
                </View>
              )}

              {/* Actions */}
              {canInteract && (
                <View style={s.actionsWrap}>
                  <TouchableOpacity
                    style={s.btnPrimary}
                    onPress={() => navigation.navigate('Messages', { recipientId: userId })}
                  >
                    <Text style={s.btnPrimaryText}>💬 Message</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.btnOutline, isFollowing && s.btnOutlineActive]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    <Text style={[s.btnOutlineText, isFollowing && s.btnOutlineTextActive]}>
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.btnOutline, hasRated && s.btnDisabled]}
                    onPress={() => !hasRated && setShowRateModal(true)}
                    disabled={hasRated}
                  >
                    <Text style={s.btnOutlineText}>{hasRated ? 'Rated ⭐' : 'Rate'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.btnGhost}
                    onPress={() => setShowReportModal(true)}
                  >
                    <Text style={s.btnGhostText}>🚩 Report</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rate Modal */}
      <Modal visible={showRateModal} transparent animationType="slide">
        <View style={m.backdrop}>
          <View style={m.sheet}>
            <Text style={m.title}>Rate {profile?.display_name}</Text>
            <Text style={m.label}>Stars</Text>
            <StarRow value={rateStars} onChange={setRateStars} />
            <Text style={[m.label, { marginTop: 16 }]}>Comment (optional)</Text>
            <TextInput
              style={m.input}
              placeholder="Share your experience..."
              placeholderTextColor="#475569"
              value={rateComment}
              onChangeText={setRateComment}
              multiline
              numberOfLines={3}
            />
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowRateModal(false)}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.submitBtn, rateLoading && m.disabled]} onPress={handleRate} disabled={rateLoading}>
                <Text style={m.submitText}>{rateLoading ? 'Submitting...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={m.backdrop}>
          <View style={m.sheet}>
            <Text style={m.title}>Report {profile?.display_name}</Text>
            <Text style={m.label}>Reason</Text>
            {REPORT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[m.reasonBtn, reportReason === r && m.reasonBtnActive]}
                onPress={() => setReportReason(r)}
              >
                <Text style={[m.reasonText, reportReason === r && m.reasonTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[m.label, { marginTop: 12 }]}>Additional details (optional)</Text>
            <TextInput
              style={m.input}
              placeholder="Describe the issue..."
              placeholderTextColor="#475569"
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              numberOfLines={3}
            />
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowReportModal(false)}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.submitBtnDanger, (!reportReason || reportLoading) && m.disabled]}
                onPress={handleReport}
                disabled={!reportReason || reportLoading}
              >
                <Text style={m.submitText}>{reportLoading ? 'Reporting...' : 'Submit report'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#6366f1', fontSize: 22 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', flex: 1 },
  publicBadge: { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  publicBadgeText: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, margin: 16, padding: 16 },
  notFound: { color: '#64748b', textAlign: 'center', paddingVertical: 24 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  identity: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  meta: { fontSize: 13, color: '#94a3b8', marginBottom: 2 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#334155', paddingVertical: 12, marginBottom: 16, gap: 24 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  statLbl: { fontSize: 11, color: '#64748b', marginTop: 2 },
  bioSection: { marginBottom: 16 },
  bioTitle: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  bioText: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btnPrimary: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnOutline: { borderWidth: 1.5, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnOutlineActive: { borderColor: '#6366f1' },
  btnOutlineText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  btnOutlineTextActive: { color: '#6366f1' },
  btnDisabled: { opacity: 0.5 },
  btnGhost: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnGhostText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
});

const sr = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 28 },
  starFilled: { color: '#facc15' },
  starEmpty: { color: '#334155' },
});

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: '#334155', textAlignVertical: 'top', minHeight: 72 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, alignItems: 'center' },
  cancelText: { color: '#94a3b8', fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#6366f1', borderRadius: 8, padding: 12, alignItems: 'center' },
  submitBtnDanger: { flex: 1, backgroundColor: '#dc2626', borderRadius: 8, padding: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  reasonBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 6 },
  reasonBtnActive: { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  reasonText: { color: '#94a3b8', fontSize: 13 },
  reasonTextActive: { color: '#818cf8', fontWeight: '600' },
});
