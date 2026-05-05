import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useTenantActiveLease, useAllTenantRequests } from '../../../lib/query/tenant-home';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#1B3C34';

type Filter = 'active' | 'resolved';

const FILTERS = [
  { key: 'active' as Filter,   label: 'Active' },
  { key: 'resolved' as Filter, label: 'Resolved' },
];

const PRIORITY_COLOR: Record<string, string> = {
  emergency: '#DC2626',
  high:      '#EA580C',
  medium:    '#D97706',
  low:       '#6B7280',
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  plumbing:   'water-outline',
  electrical: 'flash-outline',
  structural: 'construct-outline',
  appliance:  'tv-outline',
  pest:       'bug-outline',
  other:      'hammer-outline',
};

export default function TenantMaintenance() {
  const [filter, setFilter] = useState<Filter>('active');
  const { profile } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const unitId = (lease?.unit as any)?.id;
  const { data: allRequests, isLoading: requestsLoading } = useAllTenantRequests(unitId);

  const isLoading = leaseLoading || requestsLoading;

  const requests = (allRequests ?? []).filter(r =>
    filter === 'active'
      ? !['resolved', 'closed'].includes(r.status)
      : ['resolved', 'closed'].includes(r.status)
  );

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Maintenance</Text>
          <TouchableOpacity
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${PRIMARY}15`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Ionicons name="add" size={15} color={PRIMARY} />
            <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600', marginLeft: 2 }}>New Request</Text>
          </TouchableOpacity>
        </View>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {!lease ? (
        <EmptyState icon="home-outline" title="No active lease" subtitle="Contact your landlord if you think this is an error." />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={filter === 'active' ? 'checkmark-done-circle-outline' : 'construct-outline'}
          title={filter === 'active' ? 'No active requests' : 'No resolved requests'}
          subtitle={filter === 'active' ? 'Tap New Request to report an issue.' : 'Resolved requests will appear here.'}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {requests.map((r, i) => {
              const icon = CATEGORY_ICON[r.category] ?? 'hammer-outline';
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: i < requests.length - 1 ? 1 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <View style={{ marginRight: 12, alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={icon} size={18} color="#6B7280" />
                    </View>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLOR[r.priority] ?? '#6B7280', marginTop: 4 }} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{r.title}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatDate(r.created_at)}</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={r.status} />
                    <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
