import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../../../components/shared/LoadingSpinner';
import { Card } from '../../../../../components/shared/Card';
import { ListRow } from '../../../../../components/shared/ListRow';
import { Avatar } from '../../../../../components/shared/Avatar';
import { useUnit } from '../../../../../lib/query/properties';
import { formatPHP, formatDate } from '../../../../../lib/format';

const PRIMARY = '#1B3C34';

const UNIT_TYPE: Record<string, string> = {
  studio:     'Studio',
  '1br':      '1 BR',
  '2br':      '2 BR',
  '3br':      '3 BR',
  room:       'Room',
  bedspace:   'Bedspace',
  whole_unit: 'Whole Unit',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  occupied:          { color: '#15803D', bg: '#F0FDF4', label: 'Occupied',          icon: 'checkmark-circle' },
  vacant:            { color: '#B45309', bg: '#FFFBEB', label: 'Vacant',            icon: 'key-outline' },
  under_maintenance: { color: '#1D4ED8', bg: '#EFF6FF', label: 'Under Maintenance', icon: 'construct-outline' },
};

export default function UnitDetailScreen() {
  const { unitId } = useLocalSearchParams<{ id: string; unitId: string }>();
  const router = useRouter();
  const { data: unit, isLoading } = useUnit(unitId);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!unit) return null;

  const activeLease = unit.lease.find(l => l.status === 'active') ?? null;
  const primaryTenant = activeLease?.lease_tenant.find(lt => lt.role === 'primary')?.tenant ?? null;
  const coTenants = activeLease?.lease_tenant.filter(lt => lt.role !== 'primary') ?? [];
  const cfg = STATUS_CONFIG[unit.status] ?? { color: '#6B7280', bg: '#F9FAFB', label: unit.status, icon: 'home-outline' as const };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Unit {unit.unit_number}</Text>
          {unit.property && (
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unit.property.name}</Text>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={{ backgroundColor: cfg.bg, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: cfg.color + '30' }}>
          <Ionicons name={cfg.icon} size={24} color={cfg.color} />
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
            {unit.type && (
              <Text style={{ fontSize: 12, color: cfg.color, opacity: 0.8, marginTop: 2 }}>
                {UNIT_TYPE[unit.type] ?? unit.type}{unit.floor ? ` · Floor ${unit.floor}` : ''}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{formatPHP(unit.monthly_rent)}</Text>
            <Text style={{ fontSize: 11, color: '#6B7280' }}>per month</Text>
          </View>
        </View>

        {/* Tenant info */}
        {primaryTenant ? (
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Avatar name={primaryTenant.name} size={48} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{primaryTenant.name}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Primary Tenant</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/(landlord)/tenants/${primaryTenant.id}`)}
                style={{ backgroundColor: `${PRIMARY}15`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600' }}>View</Text>
              </TouchableOpacity>
            </View>
            <ListRow label="Phone" value={primaryTenant.phone ?? 'Not set'} showDivider={!!primaryTenant.email} />
            {primaryTenant.email && (
              <ListRow label="Email" value={primaryTenant.email} showDivider={false} />
            )}
            {coTenants.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Co-tenants</Text>
                {coTenants.map(ct => ct.tenant && (
                  <Text key={ct.tenant.id} style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>{ct.tenant.name}</Text>
                ))}
              </View>
            )}
          </Card>
        ) : unit.status === 'vacant' ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
            <Ionicons name="person-add-outline" size={36} color="#D1D5DB" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 10 }}>No tenant</Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Invite a tenant to link them to this unit.</Text>
            <TouchableOpacity
              onPress={() => router.push('/(landlord)/tenants/invite')}
              style={{ marginTop: 14, backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Invite Tenant</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Lease info */}
        {activeLease && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Active Lease</Text>
            <ListRow label="Start Date"        value={formatDate(activeLease.start_date)} showDivider />
            <ListRow label="End Date"          value={formatDate(activeLease.end_date)} showDivider />
            <ListRow label="Monthly Rent"      value={formatPHP(Number(activeLease.monthly_rent))} showDivider />
            <ListRow label="Security Deposit"  value={formatPHP(Number(activeLease.security_deposit))} showDivider />
            <ListRow
              label="Deposit Balance"
              value={formatPHP(Number(activeLease.security_deposit_balance))}
              showDivider={activeLease.is_rent_controlled}
            />
            {activeLease.is_rent_controlled && (
              <ListRow label="Rent Control" value="RA 9653 applies (≤ ₱10,000)" showDivider={false} />
            )}
          </Card>
        )}

        {/* Quick actions */}
        {activeLease && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => router.push(`/(landlord)/payments/record`)}
              style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              activeOpacity={0.85}
            >
              <Ionicons name="cash-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Record Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#E5E7EB' }}
              activeOpacity={0.8}
            >
              <Ionicons name="construct-outline" size={18} color="#374151" />
              <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>Maintenance</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
