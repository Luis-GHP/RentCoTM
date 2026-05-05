import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  useTenantActiveLease,
  useCurrentRentPayment,
  useRecentTenantPayments,
  useTenantUtilityBills,
  useTenantActiveRequests,
} from '../../lib/query/tenant-home';
import { useTenant } from '../../lib/query/tenants';
import { formatPHP, formatDate, getGreeting, getMonthName } from '../../lib/format';

const PRIMARY = '#1B3C34';

function RentCard({ leaseId, unitNumber, monthlyRent }: { leaseId: string; unitNumber: string; monthlyRent: number }) {
  const router = useRouter();
  const { data: payment, isLoading } = useCurrentRentPayment(leaseId);
  const now = new Date();
  const period = `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  const status = payment?.status ?? 'unpaid';
  const amountDue = payment ? Number(payment.amount_due) : monthlyRent;
  const amountPaid = Number(payment?.amount_paid ?? 0);

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>Rent · {period}</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Unit {unitNumber}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={PRIMARY} />
      ) : (
        <>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827' }}>{formatPHP(amountDue)}</Text>
          {status === 'partial' && (
            <Text style={{ fontSize: 13, color: '#B45309', marginTop: 4 }}>
              {formatPHP(amountPaid)} paid · {formatPHP(amountDue - amountPaid)} remaining
            </Text>
          )}
          {payment?.payment_date && (
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              Paid on {formatDate(payment.payment_date)}
            </Text>
          )}
        </>
      )}

      {status !== 'paid' && (
        <TouchableOpacity
          onPress={() => router.push('/(tenant)/payments')}
          style={{ marginTop: 16, backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Upload Payment Receipt</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RecentPayments({ leaseId }: { leaseId: string }) {
  const router = useRouter();
  const { data: payments, isLoading } = useRecentTenantPayments(leaseId);

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>Recent Payments</Text>
        <TouchableOpacity onPress={() => router.push('/(tenant)/payments')} activeOpacity={0.7}>
          <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600' }}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 20 }} />
        ) : (payments ?? []).length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No payment history yet</Text>
          </View>
        ) : (
          (payments ?? []).map((p, i) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => router.push(`/(tenant)/payments/${p.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < (payments!.length - 1) ? 1 : 0, borderBottomColor: '#F3F4F6' }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="checkmark-circle" size={20} color="#15803D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                  {getMonthName(p.period_month)} {p.period_year}
                </Text>
                {p.payment_date && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Paid {formatDate(p.payment_date)}</Text>
                )}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#15803D' }}>{formatPHP(p.amount_paid)}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function UtilityBills({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { data: bills, isLoading } = useTenantUtilityBills(unitId);

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>Utility Bills</Text>
        <TouchableOpacity onPress={() => router.push('/(tenant)/utilities')} activeOpacity={0.7}>
          <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600' }}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 20 }} />
        ) : (bills ?? []).length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No utility bills yet</Text>
          </View>
        ) : (
          (bills ?? []).map((b, i) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => router.push(`/(tenant)/utilities/${b.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < (bills!.length - 1) ? 1 : 0, borderBottomColor: '#F3F4F6' }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="flash-outline" size={18} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                  {getMonthName(b.period_month)} {b.period_year}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{b.kwh_consumed} kWh</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{formatPHP(b.amount)}</Text>
                <StatusBadge status={b.status} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function MaintenanceSection({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { data: requests, isLoading } = useTenantActiveRequests(unitId);

  const priorityColor: Record<string, string> = {
    emergency: '#DC2626',
    high: '#EA580C',
    medium: '#B45309',
    low: '#6B7280',
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>Maintenance</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tenant)/maintenance/new')}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${PRIMARY}15`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
          activeOpacity={0.75}
        >
          <Ionicons name="add" size={15} color={PRIMARY} />
          <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: '700', marginLeft: 2 }}>New Request</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 20 }} />
        ) : (requests ?? []).length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color="#D1D5DB" />
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>No active requests</Text>
          </View>
        ) : (
          (requests ?? []).map((r, i) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => router.push(`/(tenant)/maintenance/${r.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < (requests!.length - 1) ? 1 : 0, borderBottomColor: '#F3F4F6' }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor[r.priority] ?? '#6B7280', marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1, textTransform: 'capitalize' }}>{r.status.replace('_', ' ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

export default function TenantHome() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? undefined;

  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(tenantId);
  const { data: tenant } = useTenant(tenantId);

  const unitNumber = (lease?.unit as any)?.unit_number ?? '—';
  const propertyName = (lease?.unit as any)?.property?.name ?? '';
  const greeting = getGreeting();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Dark green header */}
      <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Image source={require('../../assets/images/logo-horizontal-white.png')} style={{ height: 28, width: 120 }} resizeMode="contain" />
          <TouchableOpacity style={{ marginRight: 12 }} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={24} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          {tenant && <Avatar name={tenant.name} size={34} />}
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{greeting}! 👋</Text>
        {propertyName ? (
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{propertyName} · Unit {unitNumber}</Text>
        ) : (
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Loading your unit...</Text>
        )}
      </View>

      {leaseLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : !lease ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="home-outline" size={48} color="#D1D5DB" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 }}>No active lease found</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Contact your landlord if you think this is an error.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <RentCard leaseId={lease.id} unitNumber={unitNumber} monthlyRent={Number(lease.monthly_rent)} />
          <RecentPayments leaseId={lease.id} />
          <UtilityBills unitId={(lease.unit as any)?.id} />
          <MaintenanceSection unitId={(lease.unit as any)?.id} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
