import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Button } from '../../../components/shared/Button';
import { useCreateTenantMaintenanceRequest } from '../../../lib/query/tenant-home';

const PRIMARY = '#2F4A7D';

type Photo = { uri: string; fileName: string; contentType?: string };

const CATEGORIES = [
  { key: 'plumbing', label: 'Plumbing', icon: 'water-outline' },
  { key: 'electrical', label: 'Electrical', icon: 'flash-outline' },
  { key: 'structural', label: 'Structural', icon: 'construct-outline' },
  { key: 'appliance', label: 'Appliance', icon: 'tv-outline' },
  { key: 'pest', label: 'Pest', icon: 'bug-outline' },
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
  { key: 'internet', label: 'Internet', icon: 'wifi-outline' },
  { key: 'other', label: 'Other', icon: 'hammer-outline' },
] as const;

const PRIORITIES = [
  { key: 'low', label: 'Low', color: '#6B7280' },
  { key: 'medium', label: 'Medium', color: '#D99A2B' },
  { key: 'high', label: 'High', color: '#EA580C' },
  { key: 'emergency', label: 'Emergency', color: '#DC2626' },
] as const;

export default function NewTenantMaintenanceRequestScreen() {
  const router = useRouter();
  const createRequest = useCreateTenantMaintenanceRequest();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('plumbing');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]['key']>('medium');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<{ id: string; failedPhotoCount: number } | null>(null);

  async function pickPhoto() {
    if (photos.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotos(current => [
      ...current,
      {
        uri: asset.uri,
        fileName: asset.fileName ?? `maintenance-${Date.now()}.jpg`,
        contentType: asset.mimeType,
      },
    ].slice(0, 3));
  }

  async function submit() {
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }

    try {
      const result = await createRequest.mutateAsync({
        title,
        description,
        category,
        priority,
        photos,
      });
      setSubmitted(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message ? `Could not submit this request: ${message}` : 'Could not submit this request right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>New Request</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? <AlertBox type="error" message={error} /> : null}

        <Field label="Title" value={title} onChange={setTitle} placeholder="What needs attention?" />
        <Field label="Description" value={description} onChange={setDescription} placeholder="Describe the issue" multiline />

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map(item => {
            const selected = category === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setCategory(item.key)}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: selected ? PRIMARY : '#E4E0DC', backgroundColor: selected ? PRIMARY : '#fff' }}
              >
                <Ionicons name={item.icon} size={15} color={selected ? '#fff' : '#6B7280'} style={{ marginRight: 5 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : '#374151' }}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Priority</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {PRIORITIES.map(item => {
            const selected = priority === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setPriority(item.key)}
                activeOpacity={0.75}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: selected ? item.color : '#E4E0DC', backgroundColor: selected ? `${item.color}14` : '#fff' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? item.color : '#374151' }}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Photos</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', padding: 14, marginBottom: 18 }}>
          {photos.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 12 }}>No photos selected</Text>
          ) : photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: index < photos.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}>
              <Ionicons name="image-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{photo.fileName}</Text>
              <TouchableOpacity onPress={() => setPhotos(current => current.filter((_, i) => i !== index))} activeOpacity={0.75}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          ))}
          <Button label={photos.length >= 3 ? 'Maximum Photos Added' : 'Add Photo'} variant="secondary" disabled={photos.length >= 3} onPress={pickPhoto} style={{ marginTop: photos.length === 0 ? 0 : 12 }} />
        </View>

        <Button label="Submit Request" loading={createRequest.isPending} onPress={submit} />
      </ScrollView>

      <Modal visible={!!submitted} transparent animationType="fade" onRequestClose={() => router.replace('/(tenant)/maintenance')}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="checkmark-circle" size={28} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Request submitted</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 6, marginBottom: 16 }}>
              Your landlord can now review this maintenance request.
            </Text>
            {submitted?.failedPhotoCount ? (
              <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Ionicons name="warning-outline" size={18} color="#B45309" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 }}>
                    {submitted.failedPhotoCount === photos.length
                      ? `The request was saved, but ${photos.length === 1 ? 'the photo could not upload' : 'the photos could not upload'}. Please tell your landlord if the attachment is important.`
                      : `${submitted.failedPhotoCount} ${submitted.failedPhotoCount === 1 ? 'photo' : 'photos'} could not upload. The request was still saved.`}
                  </Text>
                </View>
              </View>
            ) : null}
            <Button label="Back to Maintenance" onPress={() => router.replace('/(tenant)/maintenance')} style={{ marginBottom: 10 }} />
            <Button label="View Request" variant="secondary" onPress={() => submitted && router.replace(`/(tenant)/maintenance/${submitted.id}` as any)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          backgroundColor: '#fff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#E4E0DC',
          minHeight: multiline ? 116 : 52,
          paddingHorizontal: 16,
          paddingTop: multiline ? 14 : 0,
          paddingBottom: multiline ? 14 : 0,
          color: '#111827',
          fontSize: 15,
        }}
      />
    </View>
  );
}
