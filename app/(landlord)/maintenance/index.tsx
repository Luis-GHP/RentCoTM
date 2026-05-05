import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useMaintenanceRequests } from '../../../lib/query/maintenance';
import { formatDate } from '../../../lib/format';

type Filter = 'all' | 'open' | 'in_progress' | 'resolved';

const FILTERS = [
  { key: 'all' as Filter,         label: 'All' },
  { key: 'open' as Filter,        label: 'Open' },
  { key: 'in_progress' as Filter, label: 'In Progress' },
  { key: 'resolved' as Filter,    label: 'Resolved' },
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

export default function MaintenanceScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const router = useRouter();
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { data: requests, isLoading, error } = useMaintenanceRequests(filter);
  const filteredRequests = (requests ?? []).filter(r => !unitId || r.unit?.id === unitId);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Maintenance</Text>
        </View>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load requests right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title="No Requests Yet"
          subtitle={unitId ? 'This unit has no matching maintenance requests.' : filter === 'all' ? 'Maintenance requests will appear here.' : `No ${filter.replace('_', ' ')} requests.`}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {filteredRequests.map((r, i) => {
              const icon = CATEGORY_ICON[r.category] ?? 'hammer-outline';
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(landlord)/maintenance/${r.id}`)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: i < filteredRequests.length - 1 ? 1 : 0,
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
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {r.unit?.unit_number ? `Unit ${r.unit.unit_number} · ` : ''}{r.unit?.property?.name ?? ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#D1D5DB', marginTop: 1 }}>{formatDate(r.created_at)}</Text>
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
