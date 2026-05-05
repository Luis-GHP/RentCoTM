import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useDocumentsForEntity } from '../../../lib/query/documents';
import { useTenantMaintenanceRequest } from '../../../lib/query/tenant-home';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#1B3C34';

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

export default function TenantMaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: request, isLoading, error } = useTenantMaintenanceRequest(id);
  const { data: documents } = useDocumentsForEntity('maintenance_request', id);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
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
          <ListRow label="Resolved" value={request.resolved_at ? formatDate(request.resolved_at) : 'Not resolved yet'} showDivider={false} />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 14 }}>Timeline</Text>
          {STEPS.map((step, index) => {
            const active = index <= currentStep;
            return (
              <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < STEPS.length - 1 ? 14 : 0 }}>
                <View style={{ width: 26, alignItems: 'center', marginRight: 10 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: active ? PRIMARY : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
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
              onPress={() => Linking.openURL(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < photos.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
            >
              <Ionicons name="image-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{doc.file_name ?? 'Photo'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
