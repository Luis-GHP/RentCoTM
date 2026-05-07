import { View, Text, ScrollView, TouchableOpacity, Modal, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Card } from '../../../components/shared/Card';
import { Button } from '../../../components/shared/Button';
import { ListRow } from '../../../components/shared/ListRow';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { AlertBox } from '../../../components/shared/AlertBox';
import { useDocumentsForEntity } from '../../../lib/query/documents';
import {
  useMaintenanceRequest,
  useUpdateMaintenanceStatus,
  MaintenanceStatus,
} from '../../../lib/query/maintenance';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#2F4A7D';

const CATEGORY_ICON: Record<string, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  plumbing:    { name: 'water-outline',        color: '#2F4A7D' },
  electrical:  { name: 'flash-outline',        color: '#D99A2B' },
  structural:  { name: 'business-outline',     color: '#6B7280' },
  appliance:   { name: 'tv-outline',           color: '#2F4A7D' },
  pest:        { name: 'bug-outline',          color: '#DC2626' },
  cleaning:    { name: 'sparkles-outline',     color: '#C34A1A' },
  internet:    { name: 'wifi-outline',         color: '#2F4A7D' },
  other:       { name: 'construct-outline',    color: '#9CA3AF' },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:       '#14804A',
  medium:    '#FFB14A',
  high:      '#EF4444',
  emergency: '#DC2626',
};

const PRIORITY_LABEL: Record<string, string> = {
  low:       'Low',
  medium:    'Medium',
  high:      'High',
  emergency: 'Emergency',
};

const STATUS_FLOW: { key: MaintenanceStatus; label: string }[] = [
  { key: 'open',        label: 'Open' },
  { key: 'assigned',    label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Fixed - Awaiting Tenant' },
  { key: 'closed',      label: 'Closed' },
];

function statusModalCopy(status: MaintenanceStatus) {
  const copy: Record<MaintenanceStatus, { title: string; body: string; confirm: string; danger?: boolean }> = {
    open: {
      title: 'Reopen Request?',
      body: 'Move this back to open when the work needs to be reviewed again from the start.',
      confirm: 'Reopen Request',
    },
    assigned: {
      title: 'Mark Assigned?',
      body: 'Use this when the request has been assigned to you, staff, or a vendor.',
      confirm: 'Mark Assigned',
    },
    in_progress: {
      title: 'Mark In Progress?',
      body: 'Use this when repair work has started but is not ready for tenant review yet.',
      confirm: 'Mark In Progress',
    },
    resolved: {
      title: 'Mark As Fixed?',
      body: 'This tells the tenant the work is ready for their confirmation. The request stays visible until the tenant confirms or you close it as an override.',
      confirm: 'Mark Fixed',
    },
    closed: {
      title: 'Close Request?',
      body: 'Use this after the tenant confirms the fix, or as a landlord override for stale or disputed requests. Closed requests leave the active maintenance queue.',
      confirm: 'Close Request',
      danger: true,
    },
  };
  return copy[status];
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
  if (status === 'resolved') return days === 0 ? 'Fixed today' : `Fixed after ${days} ${unit}`;
  if (status === 'closed') return days === 0 ? 'Closed today' : `Closed after ${days} ${unit}`;
  return days === 0 ? 'Open today' : `Open for ${days} ${unit}`;
}

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: request, isLoading, error: loadError, refetch } = useMaintenanceRequest(id);
  const updateStatus = useUpdateMaintenanceStatus();
  const { data: documents } = useDocumentsForEntity('maintenance_request', id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingStatus, setPendingStatus] = useState<MaintenanceStatus | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (loadError || !request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Maintenance Request</Text>
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Could Not Load Request"
          subtitle="Reload the request after the latest app update."
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const categoryIcon = CATEGORY_ICON[request.category] ?? CATEGORY_ICON.other;
  const priorityColor = PRIORITY_COLOR[request.priority] ?? '#9CA3AF';
  const priorityLabel = PRIORITY_LABEL[request.priority] ?? request.priority;
  const unitNumber = request.unit?.unit_number ?? 'Not set';
  const propertyName = request.unit?.property?.name ?? '';
  const unitRoute = request.unit?.id && request.unit.property?.id
    ? `/(landlord)/properties/${request.unit.property.id}/units/${request.unit.id}`
    : null;
  const propertyRoute = request.unit?.property?.id
    ? `/(landlord)/properties/${request.unit.property.id}`
    : null;
  const tenantRoute = request.tenant?.id ? `/(landlord)/tenants/${request.tenant.id}` : null;
  const photos = (documents ?? []).filter(doc => doc.doc_type === 'photo');
  const pendingCopy = pendingStatus ? statusModalCopy(pendingStatus) : null;

  function handleStatusChange(newStatus: MaintenanceStatus) {
    if (newStatus === request!.status) return;
    setPendingStatus(newStatus);
  }

  async function doUpdate(newStatus: MaintenanceStatus) {
    setError('');
    setBusy(true);
    try {
      await updateStatus.mutateAsync({ id: request!.id, status: newStatus });
      setPendingStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setPendingStatus(null);
      setError(message || 'Failed to update status. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
            {request.title}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            Unit {unitNumber}{propertyName ? ` - ${propertyName}` : ''}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {error ? <AlertBox type="error" message={error} style={{ marginBottom: 16 }} /> : null}

        {/* Category + Priority hero */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name={categoryIcon.name} size={26} color={categoryIcon.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', textTransform: 'capitalize' }}>
                {request.category.replace(/_/g, ' ')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor }} />
                <Text style={{ fontSize: 13, color: '#6B7280' }}>{priorityLabel} Priority</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Location */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Location</Text>
          <ListRow
            label="Unit"
            value={`Unit ${unitNumber}`}
            onPress={unitRoute ? () => router.push(unitRoute as any) : undefined}
            showDivider={!!propertyName || !!request.tenant}
          />
          {propertyName ? (
            <ListRow
              label="Property"
              value={propertyName}
              onPress={propertyRoute ? () => router.push(propertyRoute as any) : undefined}
              showDivider={!!request.tenant}
            />
          ) : null}
          {request.tenant ? (
            <ListRow
              label="Reported By"
              value={request.tenant.name}
              onPress={tenantRoute ? () => router.push(tenantRoute as any) : undefined}
              showDivider={false}
            />
          ) : null}
        </Card>

        {/* Description */}
        {request.description ? (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Description</Text>
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>{request.description}</Text>
          </Card>
        ) : null}

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Photos</Text>
          {photos.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No photos attached</Text>
          ) : photos.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => setSelectedPhotoUrl(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: index < photos.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
            >
              <Image source={{ uri: doc.file_url }} style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: '#E4E0DC', marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Photo'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatDate(doc.uploaded_at)}</Text>
              </View>
              <Ionicons name="expand-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Dates */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Timeline</Text>
          <ListRow label="Submitted" value={formatDate(request.created_at)} showDivider />
          {request.resolved_at ? (
            <ListRow label="Resolved" value={formatDate(request.resolved_at)} showDivider />
          ) : null}
          <ListRow label="Duration" value={durationText(request.created_at, request.resolved_at, request.status)} showDivider={false} />
        </Card>

        {/* Status update */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Update Status</Text>
        <View style={{ gap: 8, marginBottom: 32 }}>
          {STATUS_FLOW.map(({ key, label }) => {
            const isActive = request.status === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleStatusChange(key)}
                disabled={busy || isActive}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: isActive ? PRIMARY : '#E4E0DC',
                  backgroundColor: isActive ? `${PRIMARY}0D` : '#fff',
                  opacity: busy && !isActive ? 0.5 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? PRIMARY : '#374151' }}>{label}</Text>
                </View>
                {isActive && <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />}
              </TouchableOpacity>
            );
          })}
        </View>
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

      <Modal visible={!!pendingCopy && !!pendingStatus} transparent animationType="fade" onRequestClose={() => setPendingStatus(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: pendingCopy?.danger ? '#FEF2F2' : '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name={pendingCopy?.danger ? 'lock-closed-outline' : 'checkmark-circle-outline'} size={26} color={pendingCopy?.danger ? '#DC2626' : PRIMARY} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{pendingCopy?.title}</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 21, marginTop: 6, marginBottom: 16 }}>{pendingCopy?.body}</Text>
            <Button
              label={pendingCopy?.confirm ?? 'Confirm'}
              variant={pendingCopy?.danger ? 'danger' : 'primary'}
              loading={busy}
              onPress={() => pendingStatus && doUpdate(pendingStatus)}
              style={{ marginBottom: 10 }}
            />
            <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => setPendingStatus(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
