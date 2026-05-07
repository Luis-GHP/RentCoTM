import { View, Text, ScrollView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { PageBackground } from '../../../components/shared/PageBackground';
import { MaintenanceTicketCard } from '../../../components/maintenance/MaintenanceTicketCard';
import { useMaintenanceRequests, MaintenanceFilter, MaintenanceRow } from '../../../lib/query/maintenance';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#2F4A7D';

const FILTERS = [
  { key: 'all' as MaintenanceFilter, label: 'All' },
  { key: 'open' as MaintenanceFilter, label: 'Open' },
  { key: 'in_progress' as MaintenanceFilter, label: 'In Review' },
  { key: 'resolved' as MaintenanceFilter, label: 'Fixed' },
  { key: 'closed' as MaintenanceFilter, label: 'Closed' },
];

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 16px rgba(15, 23, 42, 0.08)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
});

function matchesFilter(request: MaintenanceRow, filter: MaintenanceFilter) {
  if (filter === 'all') return true;
  if (filter === 'open') return ['open', 'assigned'].includes(request.status);
  if (filter === 'in_progress') return request.status === 'in_progress';
  return request.status === filter;
}

function dayDelta(from: string, to?: string | null) {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function durationLabel(createdAt: string, resolvedAt: string | null, status: string) {
  const days = dayDelta(createdAt, resolvedAt);
  const unit = days === 1 ? 'day' : 'days';
  if (status === 'resolved') return days === 0 ? 'Fixed today' : `Fixed after ${days} ${unit}`;
  if (status === 'closed') return days === 0 ? 'Closed today' : `Closed after ${days} ${unit}`;
  return days === 0 ? 'Opened today' : `Open ${days} ${unit}`;
}

function locationLabel(request: MaintenanceRow) {
  const unit = request.unit;
  if (!unit) return undefined;
  const propertyName = unit.property?.name ?? 'Property';
  return `${propertyName} - Unit ${unit.unit_number}`;
}

function MaintenanceHero({ requests }: { requests: MaintenanceRow[] }) {
  const insets = useSafeAreaInsets();
  const activeCount = requests.filter(request => request.status !== 'closed').length;
  const openCount = requests.filter(request => ['open', 'assigned'].includes(request.status)).length;
  const progressCount = requests.filter(request => request.status === 'in_progress').length;
  const waitingCount = requests.filter(request => request.status === 'resolved').length;

  return (
    <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: insets.top + 18, paddingBottom: 58, overflow: 'hidden' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <View style={{ position: 'absolute', width: 330, height: 196, borderRadius: 165, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', top: 30, right: -130, transform: [{ rotate: '-12deg' }] }} />
        <View style={{ position: 'absolute', width: 398, height: 238, borderRadius: 199, borderWidth: 1, borderColor: 'rgba(255,255,255,0.045)', top: 76, right: -182, transform: [{ rotate: '-12deg' }] }} />
        <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.035)', bottom: -86, left: -68 }} />
        <View style={{ position: 'absolute', left: 20, bottom: 40, width: 104, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ position: 'absolute', left: 20, bottom: 56, width: 66, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Maintenance</Text>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>Repair queue and tenant requests</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="construct-outline" size={22} color="#FFFFFF" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Attention queue</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 10, paddingVertical: 5 }}>
          <Ionicons name="clipboard-outline" size={13} color="#D7E3F6" />
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', marginLeft: 5 }}>
            {requests.length} total
          </Text>
        </View>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 38, fontWeight: '900', marginBottom: 16 }}>
        {activeCount}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#FFB14A', fontSize: 11, fontWeight: '800' }}>OPEN</Text>
          <Text style={{ color: '#FFB14A', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{openCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>IN REVIEW</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{progressCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>WAITING</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{waitingCount}</Text>
        </View>
      </View>
    </View>
  );
}

export default function MaintenanceScreen() {
  const [filter, setFilter] = useState<MaintenanceFilter>('all');
  const router = useRouter();
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { data: requests, isLoading, error } = useMaintenanceRequests('all');

  const unitScopedRequests = useMemo(() => (
    (requests ?? []).filter(request => !unitId || request.unit?.id === unitId)
  ), [requests, unitId]);
  const filteredRequests = useMemo(() => (
    unitScopedRequests.filter(request => matchesFilter(request, filter))
  ), [unitScopedRequests, filter]);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <MaintenanceHero requests={unitScopedRequests} />

        {error ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', alignItems: 'center', justifyContent: 'center', padding: 32, ...CARD_SHADOW }}>
            <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load requests right now"}</Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Reload and try again.</Text>
          </View>
        ) : unitScopedRequests.length === 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState
              icon="construct-outline"
              title="No Maintenance Requests Yet"
              subtitle={unitId ? 'This unit has no maintenance requests yet.' : 'Tenant requests will appear here as work orders.'}
            />
          </View>
        ) : (
          <>
            <View style={{ marginHorizontal: 16, marginTop: -30, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', overflow: 'hidden', ...CARD_SHADOW }}>
              <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              {filteredRequests.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', minHeight: 180 }}>
                  <EmptyState icon="construct-outline" title="No Requests Found" subtitle="Try another status filter." />
                </View>
              ) : (
                filteredRequests.map(request => (
                  <MaintenanceTicketCard
                    key={request.id}
                    title={request.title}
                    category={request.category}
                    priority={request.priority}
                    status={request.status}
                    createdLabel={formatDate(request.created_at)}
                    durationLabel={durationLabel(request.created_at, request.resolved_at, request.status)}
                    locationLabel={locationLabel(request)}
                    thumbnailUrl={request.thumbnail_url}
                    photoCount={request.photo_count}
                    onPress={() => router.push(`/(landlord)/maintenance/${request.id}`)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
