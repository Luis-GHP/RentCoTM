import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { PageBackground } from '../../../components/shared/PageBackground';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useTenantActiveLease, useAllTenantBills } from '../../../lib/query/tenant-home';
import { formatPHP, getMonthName } from '../../../lib/format';

type UtilityFilter = 'all' | 'unpaid' | 'pending' | 'paid';
type TenantBill = NonNullable<ReturnType<typeof useAllTenantBills>['data']>[number];

const PRIMARY = '#2F4A7D';
const FILTERS = [
  { key: 'all' as UtilityFilter,     label: 'All' },
  { key: 'unpaid' as UtilityFilter,  label: 'Unpaid' },
  { key: 'pending' as UtilityFilter, label: 'Review' },
  { key: 'paid' as UtilityFilter,    label: 'Paid' },
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

const UTILITY_ICON: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  electric: { icon: 'flash',        bg: '#FFFBEB', color: '#D99A2B' },
  water:    { icon: 'water',        bg: '#EDF3FF', color: '#2F4A7D' },
  internet: { icon: 'wifi',         bg: '#EDF3FF', color: '#2F4A7D' },
  other:    { icon: 'receipt',      bg: '#F1EFEC', color: '#6B7280' },
};

function billStatus(bill: TenantBill) {
  if (bill.status === 'payment_submitted') return 'payment_submitted';
  if (bill.status === 'paid' || bill.status === 'confirmed') return 'paid';
  if (bill.uploaded_by !== 'landlord' && !bill.confirmed_at) return 'pending';
  return bill.status;
}

function isPaid(bill: TenantBill) {
  const status = billStatus(bill);
  return status === 'paid' || status === 'confirmed';
}

function isPendingReview(bill: TenantBill) {
  const status = billStatus(bill);
  return status === 'pending' || status === 'payment_submitted';
}

function isUnpaid(bill: TenantBill) {
  const status = billStatus(bill);
  return status === 'unpaid' || status === 'overdue';
}

function matchesFilter(bill: TenantBill, filter: UtilityFilter) {
  if (filter === 'all') return true;
  if (filter === 'paid') return isPaid(bill);
  if (filter === 'pending') return isPendingReview(bill);
  return isUnpaid(bill);
}

function periodLabel(bill: TenantBill) {
  return `${getMonthName(bill.period_month)} ${bill.period_year}`;
}

function utilityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function receiptHint(bill: TenantBill) {
  const status = billStatus(bill);
  if (status === 'payment_submitted') return 'Receipt waiting for landlord review';
  if (isPaid(bill)) return 'Payment confirmed';
  if (status === 'pending') return 'Bill waiting for landlord confirmation';
  return 'Receipt not submitted yet';
}

function latestActionBill(bills: TenantBill[]) {
  return bills.find(isUnpaid) ?? bills.find(isPendingReview) ?? bills[0];
}

function UtilitiesHero({
  bills,
  actionBill,
  onAction,
}: {
  bills: TenantBill[];
  actionBill?: TenantBill;
  onAction: () => void;
}) {
  const insets = useSafeAreaInsets();
  const unpaidTotal = bills.filter(bill => !isPaid(bill)).reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0);
  const unpaidCount = bills.filter(isUnpaid).length;
  const paidCount = bills.filter(isPaid).length;
  const latest = bills[0];

  return (
    <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: insets.top + 18, paddingBottom: 58, overflow: 'hidden' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <View style={{ position: 'absolute', width: 330, height: 190, borderRadius: 165, borderWidth: 1, borderColor: 'rgba(255,255,255,0.075)', top: 34, right: -130, transform: [{ rotate: '-10deg' }] }} />
        <View style={{ position: 'absolute', width: 390, height: 230, borderRadius: 195, borderWidth: 1, borderColor: 'rgba(255,255,255,0.048)', top: 76, right: -178, transform: [{ rotate: '-10deg' }] }} />
        <View style={{ position: 'absolute', top: 112, left: 18, width: 96, height: 1, backgroundColor: 'rgba(255,255,255,0.09)' }} />
        <View style={{ position: 'absolute', top: 132, left: 18, width: 64, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.035)', bottom: -86, left: -68 }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Utility Bills</Text>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>Bills, usage, and receipts</Text>
        </View>
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.75}
          disabled={!actionBill}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: actionBill ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={actionBill ? '#FFFFFF' : 'rgba(255,255,255,0.38)'} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Open utility balance</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 10, paddingVertical: 5 }}>
          <Ionicons name="flash-outline" size={13} color="#FFB14A" />
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', marginLeft: 5 }}>
            {latest ? `Latest ${periodLabel(latest)}` : 'No bills'}
          </Text>
        </View>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={{ color: '#FFFFFF', fontSize: 38, fontWeight: '900', marginBottom: 16 }}>
        {formatPHP(unpaidTotal)}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#FFB14A', fontSize: 11, fontWeight: '800' }}>UNPAID</Text>
          <Text style={{ color: '#FFB14A', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{unpaidCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>PAID</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{paidCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>BILLS</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{bills.length}</Text>
        </View>
      </View>
    </View>
  );
}

function UsageTrendCard({ bills }: { bills: TenantBill[] }) {
  const usageBills = [...bills]
    .filter(bill => Number(bill.kwh_consumed ?? 0) > 0)
    .sort((a, b) => (a.period_year - b.period_year) || (a.period_month - b.period_month))
    .slice(-6);
  const maxUsage = Math.max(...usageBills.map(bill => Number(bill.kwh_consumed ?? 0)), 1);
  const totalUsage = usageBills.reduce((sum, bill) => sum + Number(bill.kwh_consumed ?? 0), 0);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E0DC', padding: 16, ...CARD_SHADOW }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827' }}>Usage Trend</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            {usageBills.length > 0 ? `${Math.round(totalUsage).toLocaleString()} kWh across recent bills` : 'Usage appears after bills include readings'}
          </Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="analytics-outline" size={18} color="#D99A2B" />
        </View>
      </View>

      {usageBills.length === 0 ? (
        <View style={{ height: 108, borderRadius: 16, backgroundColor: '#F7F6F3', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '700' }}>No usage history yet</Text>
        </View>
      ) : (
        <View style={{ height: 126, flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingTop: 8 }}>
          {usageBills.map((bill, index) => {
            const usage = Number(bill.kwh_consumed ?? 0);
            const height = Math.max(18, Math.round((usage / maxUsage) * 74));
            const isLatest = index === usageBills.length - 1;
            return (
              <View key={bill.id} style={{ flex: 1, alignItems: 'center' }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: isLatest ? PRIMARY : '#6B7280', fontSize: 11, fontWeight: '800', marginBottom: 7 }}>
                  {Math.round(usage)}
                </Text>
                <View style={{ width: '100%', maxWidth: 28, height, borderRadius: 9, backgroundColor: isLatest ? '#FFB14A' : '#D8E2F2' }} />
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '700', marginTop: 7 }}>
                  {getMonthName(bill.period_month).slice(0, 3)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function BillCard({ bill, onPress }: { bill: TenantBill; onPress: () => void }) {
  const style = UTILITY_ICON[bill.utility_type] ?? UTILITY_ICON.other;
  const status = billStatus(bill);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.76}
      style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', padding: 16, marginBottom: 10, overflow: 'hidden', ...CARD_SHADOW }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: style.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={style.icon} size={20} color={style.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827' }} numberOfLines={1}>
            {utilityLabel(bill.utility_type)} - {periodLabel(bill)}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
            {bill.provider}{bill.kwh_consumed ? ` - ${bill.kwh_consumed} kWh` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ fontSize: 15, fontWeight: '900', color: '#111827', maxWidth: 112 }}>
            {formatPHP(bill.amount)}
          </Text>
          <StatusBadge status={status} />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: '#F1EFEC', marginVertical: 13 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase' }}>Receipt</Text>
          <Text style={{ fontSize: 13, color: isPaid(bill) ? '#14804A' : '#374151', fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
            {receiptHint(bill)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

export default function TenantUtilities() {
  const router = useRouter();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<UtilityFilter>('all');
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const unitId = (lease?.unit as any)?.id;
  const { data: bills, isLoading: billsLoading } = useAllTenantBills(unitId);

  const allBills = useMemo(() => bills ?? [], [bills]);
  const isLoading = leaseLoading || billsLoading;
  const actionBill = latestActionBill(allBills);
  const filteredBills = allBills.filter(bill => matchesFilter(bill, filter));

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <UtilitiesHero
          bills={allBills}
          actionBill={actionBill}
          onAction={() => actionBill && router.push(`/(tenant)/utilities/${actionBill.id}`)}
        />

        {!lease ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState icon="home-outline" title="No Active Lease" subtitle="Contact your landlord if you think this is an error." />
          </View>
        ) : allBills.length === 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState icon="flash-outline" title="No Utility Bills Yet" subtitle="Bills will appear here once your landlord uploads them." />
          </View>
        ) : (
          <>
            <View style={{ marginHorizontal: 16, marginTop: -30, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', overflow: 'hidden', ...CARD_SHADOW }}>
              <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
            </View>

            <UsageTrendCard bills={allBills} />

            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              {filteredBills.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', minHeight: 180 }}>
                  <EmptyState icon="flash-outline" title="No Utility Bills Found" subtitle="Try a different filter." />
                </View>
              ) : (
                filteredBills.map(bill => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onPress={() => router.push(`/(tenant)/utilities/${bill.id}`)}
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
