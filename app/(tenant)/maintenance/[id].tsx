import { View, Text, TouchableOpacity, ScrollView, Linking, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useDocumentsForEntity } from '../../../lib/query/documents';
import { useRespondTenantMaintenanceResolution, useTenantMaintenanceRequest } from '../../../lib/query/tenant-home';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#2F4A7D';

const CATEGORY_LABEL: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  structural: 'Structural',
  appliance: 'Appliance',
  pest: 'Pest',
  cleaning: 'Cleaning',
  internet: 'Internet',
  other: 'Other',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  emergency: 'Emergency',
};

const STEPS = [
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

function stepIndex(status: string) {
  if (status === 'closed') return STEPS.length - 1;
  return Math.max(0, STEPS.findIndex(step => step.key === status));
}

function dayDelta(from: string, to?: string | null) {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function durationText(createdAt: string, resolvedAt: string | null, status: string) {
  const days = dayDelta(createdAt, resolvedAt);
  const unit = days === 1 ? 'day' : 'days';
  if (status === 'resolved') return days === 0 ? 'Marked fixed today' : `Marked fixed after ${days} ${unit}`;
  if (status === 'closed') return days === 0 ? 'Closed today' : `Closed after ${days} ${unit}`;
  return days === 0 ? 'Open today' : `Open for ${days} ${unit}`;
}

export default function TenantMaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: request, isLoading, error } = useTenantMaintenanceRequest(id);
  const { data: documents } = useDocumentsForEntity('maintenance_request', id);
  const respondToResolution = useRespondTenantMaintenanceResolution();
  const [resolutionAction, setResolutionAction] = useState<'fixed' | 'needs_work' | null>(null);
  const [actionError, setActionError] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load request right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const unitLabel = request.unit
    ? `Unit ${request.unit.unit_number}${request.unit.property?.name ? ` - ${request.unit.property.name}` : ''}`
    : 'Unit not set';
  const photos = (documents ?? []).filter(doc => doc.doc_type === 'photo');
  const currentStep = stepIndex(request.status);
  const actionCopy = resolutionAction === 'fixed'
    ? {
      title: 'Confirm Fixed?',
      body: 'This closes the request and tells your landlord the repair is accepted.',
      confirm: 'Confirm Fixed',
      fixed: true,
    }
    : resolutionAction === 'needs_work'
      ? {
        title: 'Send Back To Landlord?',
        body: 'Use this if the issue is still happening. The request will move back to in progress.',
        confirm: 'Still Needs Work',
        fixed: false,
      }
      : null;

  async function submitResolutionResponse(fixed: boolean) {
    if (!request) return;
    setActionError('');
    try {
      await respondToResolution.mutateAsync({ requestId: request.id, fixed });
      setResolutionAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setActionError(message || 'Could not update this request right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Maintenance Request</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unitLabel}</Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 }}>{request.title}</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 21 }}>
            {request.description ?? 'No description provided.'}
          </Text>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <ListRow label="Category" value={CATEGORY_LABEL[request.category] ?? request.category} showDivider />
          <ListRow label="Priority" value={PRIORITY_LABEL[request.priority] ?? request.priority} showDivider />
          <ListRow label="Created" value={formatDate(request.created_at)} showDivider />
          <ListRow label="Resolved" value={request.resolved_at ? formatDate(request.resolved_at) : 'Not resolved yet'} showDivider />
          <ListRow label="Duration" value={durationText(request.created_at, request.resolved_at, request.status)} showDivider={false} />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 14 }}>Timeline</Text>
          {STEPS.map((step, index) => {
            const active = index <= currentStep;
            return (
              <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < STEPS.length - 1 ? 14 : 0 }}>
                <View style={{ width: 26, alignItems: 'center', marginRight: 10 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: active ? PRIMARY : '#E4E0DC', alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: active ? '#111827' : '#9CA3AF' }}>{step.label}</Text>
              </View>
            );
          })}
        </Card>

        <Card>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Photos</Text>
          {photos.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No photos attached</Text>
          ) : photos.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => setSelectedPhotoUrl(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < photos.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
            >
              <Image source={{ uri: doc.file_url }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: '#E4E0DC', marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Photo'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
              </View>
              <Ionicons name="expand-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </Card>

        {request.status === 'resolved' ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Review the Fix</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 21 }}>
              Your landlord marked this request as fixed. Confirm it if the issue is resolved, or send it back if work is still needed.
            </Text>
            {actionError ? <Text style={{ fontSize: 13, color: '#DC2626', marginTop: 10 }}>{actionError}</Text> : null}
            <Button label="Confirm Fixed" onPress={() => setResolutionAction('fixed')} style={{ marginTop: 16, marginBottom: 10 }} />
            <Button label="Still Needs Work" variant="secondary" onPress={() => setResolutionAction('needs_work')} />
          </Card>
        ) : null}
      </ScrollView>

      <Modal visible={!!selectedPhotoUrl} transparent animationType="fade" onRequestClose={() => setSelectedPhotoUrl(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.92)', padding: 16, justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedPhotoUrl(null)}
            activeOpacity={0.8}
            style={{ position: 'absolute', top: 54, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {selectedPhotoUrl ? (
            <Image source={{ uri: selectedPhotoUrl }} resizeMode="contain" style={{ width: '100%', height: '82%' }} />
          ) : null}
          {selectedPhotoUrl ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(selectedPhotoUrl)}
              activeOpacity={0.8}
              style={{ alignSelf: 'center', marginTop: 16, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Open Original</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Modal>

      <Modal visible={!!actionCopy} transparent animationType="fade" onRequestClose={() => setResolutionAction(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: actionCopy?.fixed ? '#EAF7EF' : '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name={actionCopy?.fixed ? 'checkmark-circle-outline' : 'refresh-outline'} size={26} color={actionCopy?.fixed ? '#14804A' : '#B45309'} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{actionCopy?.title}</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 21, marginTop: 6, marginBottom: 16 }}>{actionCopy?.body}</Text>
            <Button
              label={actionCopy?.confirm ?? 'Confirm'}
              loading={respondToResolution.isPending}
              onPress={() => actionCopy && submitResolutionResponse(actionCopy.fixed)}
              style={{ marginBottom: 10 }}
            />
            <Button label="Cancel" variant="secondary" disabled={respondToResolution.isPending} onPress={() => setResolutionAction(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
