import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { FilterTabs } from '../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMaintenanceRequests, MaintenanceRow } from '../../lib/query/maintenance';
import { formatDate } from '../../lib/format';

const PRIMARY = '#1B3C34';

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
  plumbing:    'water-outline',
  electrical:  'flash-outline',
  structural:  'construct-outline',
  appliance:   'tv-outline',
  pest:        'bug-outline',
  other:       'hammer-outline',
};

function RequestRow({ row, showDivider }: { row: MaintenanceRow; showDivider: boolean }) {
  const unit     = row.unit?.unit_number ?? '—';
  const property = row.unit?.property?.name ?? '';
  const icon     = CATEGORY_ICON[row.category] ?? 'hammer-outline';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: '#F3F4F6',
      }}
    >
      {/* Priority dot + category icon */}
      <View style={{ marginRight: 12, alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color="#6B7280" />
        </View>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLOR[row.priority] ?? '#6B7280', marginTop: 4 }} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{row.title}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          Unit {unit}{property ? ` · ${property}` : ''}
        </Text>
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{formatDate(row.created_at)}</Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <StatusBadge status={row.status} />
        <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

export default function MaintenanceScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data: requests, isLoading, error } = useMaintenanceRequests(filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
          Maintenance
        </Text>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Failed to load" subtitle="Pull down to try again" />
      ) : (requests ?? []).length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title="No requests found"
          subtitle={filter !== 'all' ? 'Try a different filter' : 'Maintenance requests will appear here'}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {requests!.map((r, i) => (
              <RequestRow key={r.id} row={r} showDivider={i < requests!.length - 1} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
