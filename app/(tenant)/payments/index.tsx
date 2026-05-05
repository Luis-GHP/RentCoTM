import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useTenantActiveLease, useAllTenantPayments } from '../../../lib/query/tenant-home';
import { formatPHP, formatDate, getMonthName } from '../../../lib/format';

type Filter = 'all' | 'pending' | 'paid' | 'overdue';

const FILTERS = [
  { key: 'all' as Filter,     label: 'All' },
  { key: 'pending' as Filter, label: 'Pending' },
  { key: 'paid' as Filter,    label: 'Confirmed' },
  { key: 'overdue' as Filter, label: 'Overdue' },
];

export default function TenantPayments() {
  const [filter, setFilter] = useState<Filter>('all');
  const router = useRouter();
  const { profile } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const { data: payments, isLoading: paymentsLoading } = useAllTenantPayments(lease?.id ?? undefined);

  const isLoading = leaseLoading || paymentsLoading;
  const filteredPayments = (payments ?? []).filter(p => filter === 'all' || p.status === filter);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Payments</Text>
          <TouchableOpacity onPress={() => router.push('/(tenant)/payments')} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={24} color="#1B3C34" />
          </TouchableOpacity>
        </View>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {!lease ? (
        <EmptyState icon="home-outline" title="No Active Lease" subtitle="Contact your landlord if you think this is an error." />
      ) : (payments ?? []).length === 0 ? (
        <EmptyState icon="receipt-outline" title="No Payments Yet" subtitle="Your payment history will appear here." />
      ) : filteredPayments.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No Payments Found" subtitle="Try a different filter." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {filteredPayments.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => router.push(`/(tenant)/payments/${p.id}`)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: i < filteredPayments.length - 1 ? 1 : 0,
                  borderBottomColor: '#F3F4F6',
                }}
              >
                {/* Icon */}
                <View style={{
                  width: 40, height: 40, borderRadius: 20, marginRight: 12,
                  backgroundColor: p.status === 'paid' ? '#F0FDF4' : p.status === 'overdue' ? '#FEF2F2' : '#FFFBEB',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons
                    name={p.status === 'paid' ? 'checkmark-circle' : p.status === 'overdue' ? 'alert-circle' : 'time-outline'}
                    size={20}
                    color={p.status === 'paid' ? '#16A34A' : p.status === 'overdue' ? '#DC2626' : '#D97706'}
                  />
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {getMonthName(p.period_month)} {p.period_year}
                  </Text>
                  {p.payment_date ? (
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      Paid {formatDate(p.payment_date)}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      Due date not set
                    </Text>
                  )}
                  {p.or_number && (
                    <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{p.or_number}</Text>
                  )}
                </View>

                {/* Amount + badge */}
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{formatPHP(p.amount_due)}</Text>
                  <StatusBadge status={p.status} />
                </View>
            </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
