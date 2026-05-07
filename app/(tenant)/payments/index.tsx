import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { PageBackground } from '../../../components/shared/PageBackground';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useTenantActiveLease, useAllTenantPayments } from '../../../lib/query/tenant-home';
import { formatPHP, formatDate, getMonthName } from '../../../lib/format';

type Filter = 'all' | 'pending' | 'paid' | 'overdue';
type TenantPayment = NonNullable<ReturnType<typeof useAllTenantPayments>['data']>[number];

const PRIMARY = '#2F4A7D';

const FILTERS = [
  { key: 'all' as Filter,     label: 'All' },
  { key: 'pending' as Filter, label: 'Pending' },
  { key: 'paid' as Filter,    label: 'Confirmed' },
  { key: 'overdue' as Filter, label: 'Overdue' },
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

function normalizeFilter(value: string | string[] | undefined): Filter {
  const filter = Array.isArray(value) ? value[0] : value;
  return filter === 'pending' || filter === 'paid' || filter === 'overdue' ? filter : 'all';
}

function isPaid(status: string) {
  return ['paid', 'confirmed', 'waived'].includes(status);
}

function needsAction(status: string) {
  return ['pending', 'unpaid', 'overdue'].includes(status);
}

function matchesFilter(payment: TenantPayment, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'paid') return isPaid(payment.status);
  if (filter === 'pending') return ['pending', 'unpaid'].includes(payment.status);
  return payment.status === 'overdue';
}

function remainingAmount(payment: TenantPayment) {
  if (isPaid(payment.status)) return 0;
  return Math.max(0, Number(payment.amount_due ?? 0) - Number(payment.amount_paid ?? 0));
}

function paymentTone(status: string) {
  if (isPaid(status)) {
    return { icon: 'checkmark-circle' as const, bg: '#EAF7EF', color: '#14804A' };
  }
  if (status === 'overdue') {
    return { icon: 'alert-circle' as const, bg: '#FEF2F2', color: '#DC2626' };
  }
  return { icon: 'time-outline' as const, bg: '#FFFBEB', color: '#D99A2B' };
}

function paymentDescription(payment: TenantPayment) {
  if (isPaid(payment.status) && payment.payment_date) return `Paid ${formatDate(payment.payment_date)}`;
  if (isPaid(payment.status)) return 'Payment confirmed';
  if (payment.status === 'pending') return 'Waiting for landlord confirmation';
  if (payment.status === 'overdue') return 'Payment overdue';
  return 'Receipt not uploaded yet';
}

function periodLabel(payment: TenantPayment) {
  return `${getMonthName(payment.period_month)} ${payment.period_year}`;
}

function PaymentsHero({
  payments,
  uploadTarget,
  onUpload,
}: {
  payments: TenantPayment[];
  uploadTarget?: TenantPayment;
  onUpload: () => void;
}) {
  const insets = useSafeAreaInsets();
  const outstanding = payments.reduce((sum, payment) => sum + remainingAmount(payment), 0);
  const confirmedCount = payments.filter(payment => isPaid(payment.status)).length;
  const attentionCount = payments.filter(payment => needsAction(payment.status)).length;
  const latest = payments[0];

  return (
    <View
      style={{
        backgroundColor: PRIMARY,
        paddingHorizontal: 20,
        paddingTop: insets.top + 18,
        paddingBottom: 58,
        overflow: 'hidden',
      }}
    >
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <View style={{ position: 'absolute', width: 310, height: 190, borderRadius: 155, borderWidth: 1, borderColor: 'rgba(255,255,255,0.075)', top: 28, right: -122, transform: [{ rotate: '-13deg' }] }} />
        <View style={{ position: 'absolute', width: 380, height: 230, borderRadius: 190, borderWidth: 1, borderColor: 'rgba(255,255,255,0.048)', top: 66, right: -168, transform: [{ rotate: '-13deg' }] }} />
        <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.035)', bottom: -84, left: -66 }} />
        <View style={{ position: 'absolute', left: 20, bottom: 34, width: 102, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        <View style={{ position: 'absolute', left: 20, bottom: 50, width: 68, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Payments</Text>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>Rent history and receipts</Text>
        </View>
        <TouchableOpacity
          onPress={onUpload}
          activeOpacity={0.75}
          disabled={!uploadTarget}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: uploadTarget ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={uploadTarget ? '#FFFFFF' : 'rgba(255,255,255,0.38)'} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Outstanding balance</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 10, paddingVertical: 5 }}>
          <Ionicons name="receipt-outline" size={13} color="#D7E3F6" />
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', marginLeft: 5 }}>
            {latest ? periodLabel(latest) : 'No records'}
          </Text>
        </View>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={{ color: '#FFFFFF', fontSize: 38, fontWeight: '900', marginBottom: 16 }}>
        {formatPHP(outstanding)}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>CONFIRMED</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{confirmedCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#FFB14A', fontSize: 11, fontWeight: '800' }}>NEEDS ACTION</Text>
          <Text style={{ color: '#FFB14A', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{attentionCount}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '800' }}>RECORDS</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{payments.length}</Text>
        </View>
      </View>

      {uploadTarget ? (
        <TouchableOpacity
          onPress={onUpload}
          activeOpacity={0.82}
          style={{ marginTop: 14, borderRadius: 16, backgroundColor: '#FFFFFF', paddingVertical: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ flex: 1, color: PRIMARY, fontSize: 14, fontWeight: '900' }}>Upload receipt</Text>
          <Ionicons name="chevron-forward" size={17} color={PRIMARY} />
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.09)', paddingVertical: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>All posted rent is settled</Text>
          <Ionicons name="checkmark-circle-outline" size={18} color="#D7E3F6" />
        </View>
      )}
    </View>
  );
}

function PaymentRecordCard({ payment, onPress }: { payment: TenantPayment; onPress: () => void }) {
  const tone = paymentTone(payment.status);
  const remaining = remainingAmount(payment);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.76}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E4E0DC',
        padding: 16,
        marginBottom: 10,
        ...CARD_SHADOW,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={tone.icon} size={21} color={tone.color} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827' }} numberOfLines={1}>
            {periodLabel(payment)}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
            {paymentDescription(payment)}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ fontSize: 15, fontWeight: '900', color: '#111827', maxWidth: 112 }}>
            {formatPHP(payment.amount_due)}
          </Text>
          <StatusBadge status={payment.status} />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: '#F1EFEC', marginVertical: 13 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase' }}>
            {remaining > 0 ? 'Remaining' : 'Amount paid'}
          </Text>
          <Text style={{ fontSize: 14, color: remaining > 0 ? '#B45309' : '#14804A', fontWeight: '900', marginTop: 3 }}>
            {formatPHP(remaining > 0 ? remaining : Number(payment.amount_paid ?? payment.amount_due ?? 0))}
          </Text>
        </View>

        {payment.or_number ? (
          <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase' }}>OR</Text>
            <Text style={{ fontSize: 12, color: '#374151', fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
              {payment.or_number}
            </Text>
          </View>
        ) : null}

        <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

export default function TenantPayments() {
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const [filter, setFilter] = useState<Filter>(() => normalizeFilter(params.filter));
  const router = useRouter();
  const { profile } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const { data: payments, isLoading: paymentsLoading } = useAllTenantPayments(lease?.id ?? undefined);

  const allPayments = useMemo(() => payments ?? [], [payments]);
  const isLoading = leaseLoading || paymentsLoading;
  const filteredPayments = allPayments.filter(payment => matchesFilter(payment, filter));
  const uploadTarget = allPayments.find(payment => needsAction(payment.status));

  useEffect(() => {
    setFilter(normalizeFilter(params.filter));
  }, [params.filter]);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <PaymentsHero
          payments={allPayments}
          uploadTarget={uploadTarget}
          onUpload={() => uploadTarget && router.push(`/(tenant)/payments/${uploadTarget.id}`)}
        />

        {!lease ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState icon="home-outline" title="No Active Lease" subtitle="Contact your landlord if you think this is an error." />
          </View>
        ) : allPayments.length === 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: -32, minHeight: 260, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E4E0DC', ...CARD_SHADOW }}>
            <EmptyState icon="receipt-outline" title="No Payments Yet" subtitle="Your payment history will appear here." />
          </View>
        ) : (
          <>
            <View style={{ marginHorizontal: 16, marginTop: -30, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', overflow: 'hidden', ...CARD_SHADOW }}>
              <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              {filteredPayments.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E0DC', minHeight: 180 }}>
                  <EmptyState icon="receipt-outline" title="No Payments Found" subtitle="Try a different filter." />
                </View>
              ) : (
                filteredPayments.map(payment => (
                  <PaymentRecordCard
                    key={payment.id}
                    payment={payment}
                    onPress={() => router.push(`/(tenant)/payments/${payment.id}`)}
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
