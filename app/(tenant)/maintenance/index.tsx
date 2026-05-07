import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { PageBackground } from '../../../components/shared/PageBackground';
import { MaintenanceTicketCard } from '../../../components/maintenance/MaintenanceTicketCard';
import { useTenantActiveLease, useAllTenantRequests } from '../../../lib/query/tenant-home';
import { formatDate } from '../../../lib/format';

type Filter = 'active' | 'resolved';
type TenantMaintenanceRequest = NonNullable<ReturnType<typeof useAllTenantRequests>['data']>[number];

const PRIMARY = '#2F4A7D';

const FILTERS = [
  { key: 'active' as Filter, label: 'Active' },
  { key: 'resolved' as Filter, label: 'Fixed' },
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

function isFinished(status: string) {
  return ['resolved', 'closed'].includes(status);
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
  if (status === 'closed') return days === 0 ? 'Confirmed today' : `Confirmed after ${days} ${unit}`;
  return days === 0 ? 'Reported today' : `Open ${days} ${unit}`;
}

function MaintenanceHero({
  requests,
  onNew,
}: {
  requests: TenantMaintenanceRequest[];
  onNew: () => void;
}) {
  const insets = useSafeAreaInsets();
  const activeCount = requests.filter(request => !isFinished(request.status)).length;
  const inProgressCount = requests.filter(request => request.status === 'assigned' || request.status === 'in_progress').length;
  const waitingCount = requests.filter(request => request.status === 'resolved').length;
  const fixedCount = requests.filter(request => request.status === 'closed').length;

  return (
    <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: insets.top + 18, paddingBottom: 58, overflow: 'hidden' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <View style={{ position: 'absolute', width: 330, height: 196, borderRadius: 165, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', top: 32, right: -136, transform: [{ rotate: '-11deg' }] }} />
        <View style={{ position: 'absolute', width: 390, height: 236, borderRadius: 195, borderWidth: 1, borderColor: 'rgba(255,255,255,0.045)', top: 72, right: -184, transform: [{ rotate: '-11deg' }] }} />
        <View style={{ position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: 'rgba(255,255,255,0.035)', bottom: -84, left: -66 }} />
        <View style={{ position: 'absolute', left: 20, bottom: 42, width: 104, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ position: 'absolute', left: 20, bottom: 58, width: 66, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Maintenance</Text>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>Requests for your unit</Text>
        </View>
        <TouchableOpacity
          onPress={onNew}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 13, paddingVertical: 10 }}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 3 }}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Active repair queue</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 10, paddingVertical: 5 }}>
          <Ionicons name="construct-outline" size={13} color="#D7E3F6" />
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
          <Text style={{ color: '#FFB14A', fontSize: 11, fontWeight: '800' }}>IN REVIEW</Text>
          <Text style={{ color: '#FFB14A', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{inProgressCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>WAITING</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{waitingCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>CONFIRMED</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{fixedCount}</Text>
        </View>
      </View>
    </View>
  );
}

export default function TenantMaintenance() {
  const [filter, setFilter] = useState<Filter>('active');
  const router = useRouter();
  const { profile } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const unitId = (lease?.unit as any)?.id;
  const { data: allRequestsData, isLoading: requestsLoading } = useAllTenantRequests(unitId);

  const allRequests = useMemo(() => allRequestsData ?? [], [allRequestsData]);
  const requests = useMemo(() => (
    allRequests.filter(request => (filter === 'active' ? !isFinished(request.status) : isFinished(request.status)))
  ), [allRequests, filter]);

  const isLoading = leaseLoading || requestsLoading;
  const unit = (lease?.unit as any) ?? null;
  const locationLabel = unit
    ? `${unit.property?.name ?? 'Current property'} - Unit ${unit.unit_number}`
    : undefined;

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <MaintenanceHero requests={allRequests} onNew={() => router.push('/(tenant)/maintenance/new')} />

        {!lease ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState icon="home-outline" title="No Active Lease" subtitle="Contact your landlord if you think this is an error." />
          </View>
        ) : allRequests.length === 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState icon="construct-outline" title="No Maintenance Requests Yet" subtitle="Tap New to report an issue in your unit." />
          </View>
        ) : (
          <>
            <View style={{ marginHorizontal: 16, marginTop: -30, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', overflow: 'hidden', ...CARD_SHADOW }}>
              <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              {requests.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', minHeight: 180 }}>
                  <EmptyState icon="construct-outline" title="No Requests Found" subtitle="Try the other maintenance view." />
                </View>
              ) : (
                requests.map(request => (
                  <MaintenanceTicketCard
                    key={request.id}
                    title={request.title}
                    category={request.category}
                    priority={request.priority}
                    status={request.status}
                    createdLabel={formatDate(request.created_at)}
                    durationLabel={durationLabel(request.created_at, request.resolved_at, request.status)}
                    locationLabel={locationLabel}
                    thumbnailUrl={request.thumbnail_url}
                    photoCount={request.photo_count}
                    onPress={() => router.push(`/(tenant)/maintenance/${request.id}`)}
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
