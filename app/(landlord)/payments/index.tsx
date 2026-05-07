import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/shared/Avatar';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { AppModal } from '../../../components/shared/AppModal';
import { MainHeader } from '../../../components/shared/MainHeader';
import { PageBackground } from '../../../components/shared/PageBackground';
import { useAllPayments, PaymentRow, useGenerateRentCycle, useRentCyclePreview } from '../../../lib/query/payments';
import { formatPHP, getMonthName } from '../../../lib/format';
import { daysPastPeriodEnd } from '../../../lib/domain/periods';

const PRIMARY = '#2F4A7D';
const ACCENT_HERO = '#FFB14A';

type Filter = 'all' | 'pending' | 'paid' | 'overdue';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid',    label: 'Confirmed' },
  { key: 'overdue', label: 'Overdue' },
];

function normalizeFilter(value: string | string[] | undefined): Filter {
  const filter = Array.isArray(value) ? value[0] : value;
  return filter === 'pending' || filter === 'paid' || filter === 'overdue' ? filter : 'all';
}

function primaryTenant(row: PaymentRow): string {
  const tenants = row.lease?.lease_tenant ?? [];
  const primary = tenants.find(lt => lt.role === 'primary') ?? tenants[0];
  return primary?.tenant?.name ?? 'Unknown';
}

function unitNumber(row: PaymentRow): string {
  return row.lease?.unit?.unit_number ?? '—';
}

function overdueDays(row: Pick<PaymentRow, 'period_month' | 'period_year' | 'status'>) {
  if (['paid', 'waived'].includes(row.status)) return 0;
  return daysPastPeriodEnd(row.period_month, row.period_year);
}

function displayStatus(row: PaymentRow) {
  return overdueDays(row) > 0 ? 'overdue' : row.status;
}

function groupByPeriod(rows: PaymentRow[]): { key: string; label: string; items: PaymentRow[] }[] {
  const map = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    const key = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const [y, m] = key.split('-');
    return { key, label: `${getMonthName(parseInt(m))} ${y}`, items };
  });
}

function PaymentItem({ row, onPress }: { row: PaymentRow; onPress: () => void }) {
  const name = primaryTenant(row);
  const unit = unitNumber(row);
  const overdue = overdueDays(row);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}
    >
      <Avatar name={name} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{name}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
          Unit {unit}{overdue > 0 ? ` - ${overdue} day${overdue === 1 ? '' : 's'} overdue` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 }}>{formatPHP(row.amount_due)}</Text>
        <StatusBadge status={displayStatus(row)} />
      </View>
    </TouchableOpacity>
  );
}

function PeriodGroup({ label, items, onPressItem }: { label: string; items: PaymentRow[]; onPressItem: (id: string) => void }) {
  const collected = items.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid), 0);
  const total = items.reduce((s, i) => s + Number(i.amount_due), 0);

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#374151' }}>{label}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280' }}>{formatPHP(collected)} / {formatPHP(total)}</Text>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F1EFEC' }}>
        {items.map(row => (
          <PaymentItem key={row.id} row={row} onPress={() => onPressItem(row.id)} />
        ))}
      </View>
    </View>
  );
}

function RentCycleHeaderPanel({
  missingCount,
  existingCount,
  totalExpected,
  totalCollected,
  periodLabel,
  loading,
  onPost,
}: {
  missingCount: number;
  existingCount: number;
  totalExpected: number;
  totalCollected: number;
  periodLabel: string;
  loading: boolean;
  onPost: () => void;
}) {
  const complete = missingCount === 0 && existingCount > 0;
  const outstanding = Math.max(0, totalExpected - totalCollected);

  return (
    <View style={{ borderRadius: 18, backgroundColor: 'rgba(30,49,88,0.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 15 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Ionicons name="receipt-outline" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>{periodLabel} Rent Cycle</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 2 }} numberOfLines={1}>
            {missingCount > 0 ? `${missingCount} active lease${missingCount === 1 ? '' : 's'} still need rent rows` : complete ? 'All active leases are posted' : 'No active leases in this period'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPost}
          disabled={loading || missingCount === 0}
          activeOpacity={0.82}
          style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: missingCount === 0 ? 'rgba(255,255,255,0.12)' : '#C34A1A', opacity: loading ? 0.7 : 1 }}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: missingCount === 0 ? 'rgba(255,255,255,0.72)' : '#fff' }}>
            {loading ? 'Posting' : missingCount === 0 ? 'Posted' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: '900', textTransform: 'uppercase' }}>Expected</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>{formatPHP(totalExpected)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: '900', textTransform: 'uppercase' }}>Collected</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: ACCENT_HERO, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatPHP(totalCollected)}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: '900', textTransform: 'uppercase' }}>Outstanding</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: outstanding > 0 ? '#FCA5A5' : '#fff', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatPHP(outstanding)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function PaymentsScreen() {
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const [filter, setFilter] = useState<Filter>(() => normalizeFilter(params.filter));
  const [cycleConfirmOpen, setCycleConfirmOpen] = useState(false);
  const [cycleResult, setCycleResult] = useState<{ title: string; message: string } | null>(null);
  const router = useRouter();
  const { data: payments, isLoading, error } = useAllPayments();
  const { data: cycle } = useRentCyclePreview();
  const generateCycle = useGenerateRentCycle();

  useEffect(() => {
    setFilter(normalizeFilter(params.filter));
  }, [params.filter]);

  const filtered = (payments ?? []).filter(p => {
    const status = displayStatus(p);
    if (filter === 'all') return true;
    if (filter === 'pending') return p.status === 'pending' && status !== 'overdue';
    return status === filter;
  });
  const groups = groupByPeriod(filtered);
  const cycleLabel = cycle ? `${getMonthName(cycle.periodMonth)} ${cycle.periodYear}` : 'Current Month';

  async function postRentCycle() {
    if (!cycle || cycle.missingCount === 0) return;
    try {
      const result = await generateCycle.mutateAsync({ periodMonth: cycle.periodMonth, periodYear: cycle.periodYear });
      setCycleConfirmOpen(false);
      setCycleResult({
        title: result.createdCount > 0 ? 'Rent Posted' : 'Nothing New to Post',
        message: result.createdCount > 0
          ? `${result.createdCount} rent record${result.createdCount === 1 ? '' : 's'} added for ${cycleLabel}.`
          : `${cycleLabel} already has rent records for every active lease.`,
      });
    } catch {
      setCycleConfirmOpen(false);
      setCycleResult({
        title: 'Could Not Post Rent',
        message: 'The rent cycle was not updated. Please try again after checking your connection.',
      });
    }
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <MainHeader
        title="Payments"
        subtitle="Rent collection overview"
        right={(
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setCycleConfirmOpen(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(landlord)/payments/record')}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      >
        <RentCycleHeaderPanel
          missingCount={cycle?.missingCount ?? 0}
          existingCount={cycle?.existingCount ?? 0}
          totalExpected={cycle?.totalExpected ?? 0}
          totalCollected={cycle?.totalCollected ?? 0}
          periodLabel={cycleLabel}
          loading={generateCycle.isPending}
          onPost={() => setCycleConfirmOpen(true)}
        />
      </MainHeader>
      <View style={{
        marginHorizontal: 12,
        marginTop: -18,
        marginBottom: 8,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E4E0DC',
        padding: 8,
        zIndex: 2,
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{ minWidth: 70, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: filter === f.key ? PRIMARY : '#F1EFEC' }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: filter === f.key ? '#fff' : '#6B7280' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load payments right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {groups.length === 0 ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F1EFEC', minHeight: 260 }}>
              <EmptyState
                icon="receipt-outline"
                title={filter === 'all' ? 'No Payments Yet' : `No ${FILTERS.find(f => f.key === filter)?.label ?? 'Matching'} Payments Yet`}
                subtitle={filter === 'all' ? "Post this month's rent cycle or record a one-off payment." : 'Try another filter or record a new payment.'}
                actionLabel={filter === 'all' ? 'Record Payment' : undefined}
                onAction={filter === 'all' ? () => router.push('/(landlord)/payments/record') : undefined}
              />
            </View>
          ) : null}
          {groups.map(g => (
            <PeriodGroup
              key={g.key}
              label={g.label}
              items={g.items}
              onPressItem={id => router.push(`/(landlord)/payments/${id}`)}
            />
          ))}
        </ScrollView>
      )}
      <AppModal
        visible={cycleConfirmOpen}
        tone="info"
        title={`Post ${cycleLabel} Rent?`}
        message={cycle?.missingCount
          ? `This will create ${cycle.missingCount} pending rent record${cycle.missingCount === 1 ? '' : 's'} for active leases that do not have one yet.`
          : `${cycleLabel} already has rent records for every active lease.`}
        cancelLabel="Cancel"
        confirmLabel={cycle?.missingCount ? 'Post Rent' : 'Done'}
        loading={generateCycle.isPending}
        onCancel={() => !generateCycle.isPending && setCycleConfirmOpen(false)}
        onConfirm={cycle?.missingCount ? postRentCycle : () => setCycleConfirmOpen(false)}
      />
      <AppModal
        visible={!!cycleResult}
        tone={cycleResult?.title === 'Could Not Post Rent' ? 'danger' : 'success'}
        title={cycleResult?.title ?? ''}
        message={cycleResult?.message ?? ''}
        confirmLabel="Done"
        onConfirm={() => setCycleResult(null)}
      />
    </SafeAreaView>
  );
}
