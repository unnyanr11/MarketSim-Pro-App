/**
 * PhotoCapture — capture → preview → confirm flow
 *
 * UX flow:
 *   1. Tap "📷 Add Photo" → choose Camera or Gallery
 *   2. Preview modal → Retake / ✓ Use Photo
 *   3. On confirm → thumbnail + spinner appears immediately
 *   4. Upload runs in background; spinner → ✓ tick on success
 *   5. Error state → red thumb with ↺ retry button
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadTaskPhoto } from '../api/tasks';

type PhotoStatus = 'uploading' | 'done' | 'error';

type PhotoState = {
  uri: string;
  url: string | null;
  status: PhotoStatus;
};

interface Props {
  taskId: number;
  userId: number;
  floorNumber?: number;
  roomNumber?: string;
  maxPhotos?: number;
  required?: boolean;
  onPhotosChange: (urls: string[]) => void;
}

export function PhotoCapture({
  taskId, userId, floorNumber, roomNumber,
  maxPhotos = 3,
  required = false,
  onPhotosChange,
}: Props) {
  const [photos, setPhotos]   = useState<PhotoState[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  // Track photo count via ref so callbacks never use stale closure values
  const photoCountRef = useRef(0);

  // ─ upload + track result ──────────────────────────────────────────────────

  const uploadAndTrack = useCallback(async (uri: string, index: number) => {
    const url = await uploadTaskPhoto(taskId, userId, uri, index, floorNumber, roomNumber);
    setPhotos(prev => {
      const next = prev.map(p =>
        p.uri === uri
          ? { ...p, url: url ?? null, status: (url ? 'done' : 'error') as PhotoStatus }
          : p
      );
      // notify parent with only successfully uploaded URLs
      onPhotosChange(next.filter(p => p.url).map(p => p.url!));
      return next;
    });
  }, [taskId, userId, floorNumber, roomNumber, onPhotosChange]);

  // ─ confirm a previewed photo ──────────────────────────────────────────────
  // IMPORTANT: do NOT read photos.length here — it would cause setState-in-render.
  // Derive the index inside the setPhotos updater from prev.length instead.

  const confirmPhoto = useCallback((uri: string) => {
    setPreview(null);
    let capturedIndex = 0;
    setPhotos(prev => {
      capturedIndex = prev.length;
      photoCountRef.current = prev.length + 1;
      return [...prev, { uri, url: null, status: 'uploading' }];
    });
    // uploadAndTrack is called after the state update via a microtask so the
    // index is always accurate and we never call setState during render.
    setTimeout(() => uploadAndTrack(uri, capturedIndex), 0);
  }, [uploadAndTrack]);

  // ─ remove ─────────────────────────────────────────────────────────────────

  const removePhoto = useCallback((uri: string) => {
    setPhotos(prev => {
      const next = prev.filter(p => p.uri !== uri);
      photoCountRef.current = next.length;
      onPhotosChange(next.filter(p => p.url).map(p => p.url!));
      return next;
    });
  }, [onPhotosChange]);

  // ─ retry ──────────────────────────────────────────────────────────────────

  const retryPhoto = useCallback((uri: string) => {
    let index = 0;
    setPhotos(prev => {
      index = prev.findIndex(p => p.uri === uri);
      return prev.map(p =>
        p.uri === uri ? { ...p, status: 'uploading', url: null } : p
      );
    });
    setTimeout(() => uploadAndTrack(uri, index), 0);
  }, [uploadAndTrack]);

  // ─ pick source ────────────────────────────────────────────────────────────

  const pickSource = useCallback(() => {
    if (photoCountRef.current >= maxPhotos) {
      Alert.alert('Limit Reached', `Max ${maxPhotos} photo${maxPhotos > 1 ? 's' : ''} allowed.`);
      return;
    }
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: '📷 Camera',
        onPress: async () => {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();
          if (!granted) { Alert.alert('Permission Required', 'Camera access is needed.'); return; }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
          const asset = r.assets?.[0];
          if (!r.canceled && asset) setPreview(asset.uri);
        },
      },
      {
        text: '🖼 Gallery',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false });
          const asset = r.assets?.[0];
          if (!r.canceled && asset) setPreview(asset.uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [maxPhotos]);

  const doneCount = photos.filter(p => p.status === 'done').length;

  return (
    <View>
      {/* ── header row ── */}
      <View style={S.headerRow}>
        <View style={S.titleWrap}>
          <Text style={S.title}>Room Photos ({photos.length}/{maxPhotos})</Text>
          {required && (
            <View style={S.requiredBadge}>
              <Text style={S.requiredText}>Required</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={pickSource}
          style={[S.addBtn, photos.length >= maxPhotos && S.addBtnDisabled]}
          disabled={photos.length >= maxPhotos}
        >
          <Text style={S.addBtnText}>+ Add Photo</Text>
        </TouchableOpacity>
      </View>

      {/* ── hint ── */}
      {photos.length === 0 && (
        <Text style={S.hint}>
          {required
            ? '⚠️ At least 1 photo required for checkout rooms (guest protection + proof of condition).'
            : 'Photos optional for stay-over rooms — serve as proof of condition.'}
        </Text>
      )}

      {/* ── upload status bar ── */}
      {photos.some(p => p.status === 'uploading') && (
        <View style={S.uploadingBar}>
          <ActivityIndicator size="small" color="#0ea5e9" />
          <Text style={S.uploadingText}>Uploading in background…</Text>
        </View>
      )}
      {photos.length > 0 && photos.every(p => p.status === 'done') && (
        <View style={S.uploadedBar}>
          <Text style={S.uploadedText}>✓ {doneCount} photo{doneCount > 1 ? 's' : ''} uploaded</Text>
        </View>
      )}

      {/* ── thumbnails ── */}
      <View style={S.thumbRow}>
        {photos.map(photo => (
          <View
            key={photo.uri}
            style={[S.thumbWrap, photo.status === 'error' && S.thumbWrapError]}
          >
            <Image source={{ uri: photo.uri }} style={S.thumb} />

            {photo.status === 'uploading' && (
              <View style={S.thumbOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            {photo.status === 'done' && (
              <View style={[S.thumbOverlay, S.thumbOverlayDone]}>
                <Text style={S.thumbDoneTick}>✓</Text>
              </View>
            )}
            {photo.status === 'error' && (
              <TouchableOpacity
                style={[S.thumbOverlay, S.thumbOverlayError]}
                onPress={() => retryPhoto(photo.uri)}
              >
                <Text style={S.thumbErrorIcon}>↺</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={S.removeBtn} onPress={() => removePhoto(photo.uri)}>
              <Text style={S.removeBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* ── preview modal ── */}
      <Modal visible={!!preview} animationType="fade" transparent>
        <View style={S.modalBg}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Preview</Text>
            {preview && (
              <Image
                source={{ uri: preview }}
                style={S.modalImage}
                resizeMode="contain"
              />
            )}
            <Text style={S.modalHint}>Does this photo clearly show the room condition?</Text>
            <View style={S.modalActions}>
              <TouchableOpacity
                style={[S.modalBtn, S.modalBtnRetake]}
                onPress={() => { setPreview(null); pickSource(); }}
              >
                <Text style={S.modalBtnText}>↺ Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.modalBtn, S.modalBtnConfirm]}
                onPress={() => preview && confirmPhoto(preview)}
              >
                <Text style={S.modalBtnText}>✓ Use Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  headerRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleWrap:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:             { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  requiredBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#ef444422', borderWidth: 1, borderColor: '#ef4444' },
  requiredText:      { fontSize: 11, fontWeight: '700', color: '#ef4444' },
  addBtn:            { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0ea5e911', borderRadius: 6, borderWidth: 1, borderColor: '#0ea5e9' },
  addBtnDisabled:    { opacity: 0.35 },
  addBtnText:        { color: '#0ea5e9', fontSize: 13, fontWeight: '600' },
  hint:              { fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 18 },
  uploadingBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, padding: 8, backgroundColor: '#0ea5e911', borderRadius: 6 },
  uploadingText:     { fontSize: 13, color: '#0ea5e9' },
  uploadedBar:       { marginBottom: 8, padding: 8, backgroundColor: '#22c55e11', borderRadius: 6 },
  uploadedText:      { fontSize: 13, color: '#22c55e', fontWeight: '600' },
  thumbRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap:         { position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  thumbWrapError:    { borderColor: '#ef4444', borderWidth: 2 },
  thumb:             { width: '100%', height: '100%' },
  thumbOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  thumbOverlayDone:  { backgroundColor: 'rgba(34,197,94,0.55)' },
  thumbOverlayError: { backgroundColor: 'rgba(239,68,68,0.6)' },
  thumbDoneTick:     { color: '#fff', fontSize: 22, fontWeight: '800' },
  thumbErrorIcon:    { color: '#fff', fontSize: 24, fontWeight: '800' },
  removeBtn:         { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  removeBtnText:     { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 20 },
  modalBg:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard:         { width: '100%', backgroundColor: '#1e293b', borderRadius: 16, overflow: 'hidden', padding: 16 },
  modalTitle:        { fontSize: 17, fontWeight: '700', color: '#f1f5f9', marginBottom: 12, textAlign: 'center' },
  modalImage:        { width: '100%', height: 320, borderRadius: 10, backgroundColor: '#0f172a', marginBottom: 12 },
  modalHint:         { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  modalActions:      { flexDirection: 'row', gap: 12 },
  modalBtn:          { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnRetake:    { backgroundColor: '#334155' },
  modalBtnConfirm:   { backgroundColor: '#0ea5e9' },
  modalBtnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
});
