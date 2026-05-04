import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useTenantActiveLease, useAllTenantPayments } from '../../lib/query/tenant-home';
import { formatPHP, formatDate, getMonthName } from '../../lib/format';

export default function TenantPayments() {
  const { profile } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const { data: payments, isLoading: paymentsLoading } = useAllTenantPayments(lease?.id ?? undefined);

  const isLoading = leaseLoading || paymentsLoading;

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Payments</Text>
      </View>

      {!lease ? (
        <EmptyState icon="home-outline" title="No active lease" subtitle="Contact your landlord if you think this is an error." />
      ) : (payments ?? []).length === 0 ? (
        <EmptyState icon="receipt-outline" title="No payments yet" subtitle="Your payment history will appear here." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {payments!.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: i < payments!.length - 1 ? 1 : 0,
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
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
