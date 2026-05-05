import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Avatar } from '../../../components/shared/Avatar';
import { EmptyState } from '../../../components/shared/EmptyState';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useAllTenants, TenantListFilter, LandlordTenantRow } from '../../../lib/query/tenants';
import { formatPHP } from '../../../lib/format';

const PRIMARY = '#1B3C34';

const FILTERS = [
  { key: 'active' as TenantListFilter, label: 'Active' },
  { key: 'inactive' as TenantListFilter, label: 'Inactive' },
];

function TenantRow({ tenant, onPress }: { tenant: LandlordTenantRow; onPress: () => void }) {
  const location = tenant.unit_number
    ? `Unit ${tenant.unit_number}${tenant.property_name ? ` - ${tenant.property_name}` : ''}`
    : 'No unit assigned';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
    >
      <Avatar name={tenant.name} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{tenant.name}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{location}</Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatPHP(tenant.monthly_rent)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

export default function TenantsScreen() {
  const [filter, setFilter] = useState<TenantListFilter>('active');
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { data: tenants, isLoading, error } = useAllTenants(filter, search);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Tenants</Text>
          <TouchableOpacity onPress={() => router.push('/(landlord)/tenants/invite')} activeOpacity={0.7}>
            <Ionicons name="person-add-outline" size={24} color={PRIMARY} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, height: 42 }}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search tenants, units, properties..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load tenants right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      ) : (tenants ?? []).length === 0 ? (
        <EmptyState
          icon={search ? 'search-outline' : 'people-outline'}
          title={search ? 'No Tenants Found' : 'No Tenants Yet'}
          subtitle={search ? 'No tenants match your search.' : 'Tap the invite icon to add your first tenant.'}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {tenants!.map(tenant => (
              <TenantRow
                key={`${tenant.tenant_id}-${tenant.lease_id ?? 'none'}`}
                tenant={tenant}
                onPress={() => router.push(`/(landlord)/tenants/${tenant.tenant_id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
