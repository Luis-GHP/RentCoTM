import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useTenantActiveLease, useAllTenantBills } from '../../../lib/query/tenant-home';
import { formatPHP, getMonthName } from '../../../lib/format';

const UTILITY_ICON: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  electric: { icon: 'flash',        bg: '#FFFBEB', color: '#D97706' },
  water:    { icon: 'water',        bg: '#EFF6FF', color: '#2563EB' },
  internet: { icon: 'wifi',         bg: '#F5F3FF', color: '#7C3AED' },
  other:    { icon: 'receipt',      bg: '#F3F4F6', color: '#6B7280' },
};

export default function TenantUtilities() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);
  const unitId = (lease?.unit as any)?.id;
  const { data: bills, isLoading: billsLoading } = useAllTenantBills(unitId);

  const isLoading = leaseLoading || billsLoading;
  const uploadTarget = (bills ?? [])[0];

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Utility Bills</Text>
        <TouchableOpacity
          onPress={() => uploadTarget && router.push(`/(tenant)/utilities/${uploadTarget.id}`)}
          activeOpacity={0.7}
          disabled={!uploadTarget}
        >
          <Ionicons name="cloud-upload-outline" size={24} color={uploadTarget ? '#1B3C34' : '#D1D5DB'} />
        </TouchableOpacity>
      </View>

      {!lease ? (
        <EmptyState icon="home-outline" title="No Active Lease" subtitle="Contact your landlord if you think this is an error." />
      ) : (bills ?? []).length === 0 ? (
        <EmptyState icon="flash-outline" title="No Utility Bills Yet" subtitle="Bills will appear here once your landlord uploads them." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {bills!.map((b, i) => {
              const style = UTILITY_ICON[b.utility_type] ?? UTILITY_ICON.other;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => router.push(`/(tenant)/utilities/${b.id}`)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: i < bills!.length - 1 ? 1 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  {/* Icon */}
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: style.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={style.icon} size={18} color={style.color} />
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', textTransform: 'capitalize' }}>
                      {b.utility_type} · {getMonthName(b.period_month)} {b.period_year}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {b.provider}{b.kwh_consumed ? ` · ${b.kwh_consumed} kWh` : ''}
                    </Text>
                  </View>

                  {/* Amount + badge */}
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{formatPHP(b.amount)}</Text>
                    <StatusBadge status={b.status} />
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
