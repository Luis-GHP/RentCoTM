import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { AlertBox } from '../../../components/shared/AlertBox';
import {
  useMaintenanceRequest,
  useUpdateMaintenanceStatus,
  MaintenanceStatus,
} from '../../../lib/query/maintenance';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#1B3C34';

const CATEGORY_ICON: Record<string, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  plumbing:    { name: 'water-outline',        color: '#2563EB' },
  electrical:  { name: 'flash-outline',        color: '#D97706' },
  structural:  { name: 'business-outline',     color: '#6B7280' },
  appliance:   { name: 'tv-outline',           color: '#7C3AED' },
  pest:        { name: 'bug-outline',          color: '#DC2626' },
  cleaning:    { name: 'sparkles-outline',     color: '#059669' },
  internet:    { name: 'wifi-outline',         color: '#0284C7' },
  other:       { name: 'construct-outline',    color: '#9CA3AF' },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:       '#22C55E',
  medium:    '#F59E0B',
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
  { key: 'resolved',    label: 'Resolved' },
  { key: 'closed',      label: 'Closed' },
];

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: request, isLoading } = useMaintenanceRequest(id);
  const updateStatus = useUpdateMaintenanceStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!request) return null;

  const categoryIcon = CATEGORY_ICON[request.category] ?? CATEGORY_ICON.other;
  const priorityColor = PRIORITY_COLOR[request.priority] ?? '#9CA3AF';
  const priorityLabel = PRIORITY_LABEL[request.priority] ?? request.priority;
  const unitNumber = request.unit?.unit_number ?? '—';
  const propertyName = request.unit?.property?.name ?? '';

  async function handleStatusChange(newStatus: MaintenanceStatus) {
    if (newStatus === request!.status) return;

    const confirmMsg =
      newStatus === 'resolved'
        ? 'Mark this request as resolved? The resolved date will be set to now.'
        : newStatus === 'closed'
        ? 'Close this request? This is typically done after the tenant confirms the fix.'
        : null;

    if (confirmMsg) {
      Alert.alert('Update Status', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => doUpdate(newStatus),
        },
      ]);
    } else {
      doUpdate(newStatus);
    }
  }

  async function doUpdate(newStatus: MaintenanceStatus) {
    setError('');
    setBusy(true);
    try {
      await updateStatus.mutateAsync({ id: request!.id, status: newStatus });
    } catch {
      setError('Failed to update status. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
            {request.title}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            Unit {unitNumber}{propertyName ? ` · ${propertyName}` : ''}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {error ? <AlertBox type="error" message={error} style={{ marginBottom: 16 }} /> : null}

        {/* Category + Priority hero */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
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
          <ListRow label="Unit" value={`Unit ${unitNumber}`} showDivider={!!propertyName} />
          {propertyName ? <ListRow label="Property" value={propertyName} showDivider={false} /> : null}
          {request.tenant ? <ListRow label="Reported By" value={request.tenant.name} showDivider={false} /> : null}
        </Card>

        {/* Description */}
        {request.description ? (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Description</Text>
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>{request.description}</Text>
          </Card>
        ) : null}

        {/* Dates */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Timeline</Text>
          <ListRow label="Submitted" value={formatDate(request.created_at)} showDivider={!!request.resolved_at} />
          {request.resolved_at ? (
            <ListRow label="Resolved" value={formatDate(request.resolved_at)} showDivider={false} />
          ) : null}
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
                  borderColor: isActive ? PRIMARY : '#E5E7EB',
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
    </SafeAreaView>
  );
}
