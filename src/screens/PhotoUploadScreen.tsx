import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/client';
import { useAuth } from '../hooks/useAuth';
import { log, error as logError } from '../lib/logger';

interface Props {
  route: { params: { taskId: number; roomNumber: string; onComplete?: (urls: string[]) => void } };
  navigation: { goBack: () => void };
}

export function PhotoUploadScreen({ route, navigation }: Props) {
  const { taskId, roomNumber, onComplete } = route.params;
  const { user } = useAuth();
  const [photos, setPhotos] = useState<{ uri: string; uploading: boolean; url?: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const pickPhoto = useCallback(async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit Reached', 'You can upload up to 3 photos per task.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  }, [photos]);

  const takePhoto = useCallback(async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit Reached', 'You can upload up to 3 photos per task.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  }, [photos]);

  const uploadPhoto = async (uri: string) => {
    const idx = photos.length;
    setPhotos(prev => [...prev, { uri, uploading: true }]);
    try {
      const ext = uri.split('.').pop() ?? 'jpg';
      const fileName = `tasks/${taskId}/photo_${Date.now()}_${idx}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from('room-photos')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('room-photos').getPublicUrl(data.path);
      setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, uploading: false, url: urlData.publicUrl } : p));
      log('Photo uploaded:', urlData.publicUrl);
    } catch (err) {
      logError('uploadPhoto', err);
      setPhotos(prev => prev.filter((_, i) => i !== idx));
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const uploadedUrls = photos.filter(p => p.url).map(p => p.url!);
    if (uploadedUrls.length === 0) {
      Alert.alert('No Photos', 'Please take or select at least one photo.');
      return;
    }
    if (photos.some(p => p.uploading)) {
      Alert.alert('Please Wait', 'Photos are still uploading...');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('housekeeping_tasks')
        .update({ photos: uploadedUrls, updated_at: new Date().toISOString() })
        .eq('task_id', taskId);
      if (error) throw error;
      onComplete?.(uploadedUrls);
      Alert.alert('✅ Photos Saved', `${uploadedUrls.length} photo(s) attached to this task.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      logError('handleSave', err);
      Alert.alert('Error', 'Failed to save photos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Room Photos</Text>
          <Text style={styles.subtitle}>Room {roomNumber}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>📷 Take up to 3 photos as proof of cleaning. Photos are saved to the task record.</Text>
        </View>

        {/* Photo Grid */}
        <View style={styles.grid}>
          {photos.map((p, idx) => (
            <View key={idx} style={styles.photoBox}>
              <Image source={{ uri: p.uri }} style={styles.photo} />
              {p.uploading && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.overlayText}>Uploading...</Text>
                </View>
              )}
              {!p.uploading && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(idx)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              )}
              {p.url && (
                <View style={styles.uploadedBadge}>
                  <Text style={styles.uploadedText}>✓</Text>
                </View>
              )}
            </View>
          ))}
          {photos.length < 3 && (
            <View style={styles.addBox}>
              <Text style={styles.addCount}>{photos.length}/3</Text>
              <Text style={styles.addText}>Add Photo</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={[styles.btn, styles.btnCamera]} onPress={takePhoto} disabled={photos.length >= 3}>
          <Text style={styles.btnText}>📸 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGallery]} onPress={pickPhoto} disabled={photos.length >= 3}>
          <Text style={styles.btnText}>🖼 Choose from Gallery</Text>
        </TouchableOpacity>

        {photos.length > 0 && (
          <TouchableOpacity
            style={[styles.btn, styles.btnSave, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving || photos.some(p => p.uploading)}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>💾 Save Photos to Task</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 12 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#0ea5e9', fontSize: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
  infoBox: { margin: 16, padding: 14, backgroundColor: '#1e293b', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#0ea5e9' },
  infoText: { fontSize: 13, color: '#94a3b8', lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  photoBox: { width: '45%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  overlayText: { color: '#fff', fontSize: 11, marginTop: 4 },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  uploadedBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#22c55e', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  uploadedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBox: { width: '45%', aspectRatio: 4 / 3, borderRadius: 10, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addCount: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  addText: { fontSize: 13, color: '#64748b' },
  btn: { marginHorizontal: 16, marginTop: 10, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  btnCamera: { backgroundColor: '#0ea5e9' },
  btnGallery: { backgroundColor: '#475569' },
  btnSave: { backgroundColor: '#22c55e' },
  btnDisabled: { backgroundColor: '#334155' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
