import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../../components/shared/LoadingSpinner';
import { Card } from '../../../../components/shared/Card';
import { ListRow } from '../../../../components/shared/ListRow';
import { useProperty, UnitSummary } from '../../../../lib/query/properties';
import { formatPHP } from '../../../../lib/format';

const PRIMARY = '#1B3C34';

const ELECTRIC_PROVIDER: Record<string, string> = {
  meralco: 'Meralco',
  veco:    'VECO',
  dlpc:    'DLPC',
  beneco:  'BENECO',
  neeco:   'NEECO',
  manual:  'Manual',
};

const UNIT_TYPE: Record<string, string> = {
  studio:     'Studio',
  '1br':      '1 BR',
  '2br':      '2 BR',
  '3br':      '3 BR',
  room:       'Room',
  bedspace:   'Bedspace',
  whole_unit: 'Whole Unit',
};

const UNIT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  occupied:          { color: '#15803D', bg: '#F0FDF4', label: 'Occupied' },
  vacant:            { color: '#B45309', bg: '#FFFBEB', label: 'Vacant' },
  under_maintenance: { color: '#1D4ED8', bg: '#EFF6FF', label: 'Under Maintenance' },
};

function activeTenantName(unit: UnitSummary): string | null {
  const activeLease = unit.lease.find(l => l.status === 'active');
  if (!activeLease) return null;
  const primary = activeLease.lease_tenant.find(lt => lt.role === 'primary') ?? activeLease.lease_tenant[0];
  return primary?.tenant?.name ?? null;
}

function UnitCard({ unit, propertyId }: { unit: UnitSummary; propertyId: string }) {
  const router = useRouter();
  const cfg = UNIT_STATUS_CONFIG[unit.status] ?? { color: '#6B7280', bg: '#F9FAFB', label: unit.status };
  const tenantName = activeTenantName(unit);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/(landlord)/properties/${propertyId}/units/${unit.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <Ionicons name="home-outline" size={20} color={cfg.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
          Unit {unit.unit_number}
          {unit.type ? <Text style={{ fontWeight: '400', color: '#6B7280' }}> · {UNIT_TYPE[unit.type] ?? unit.type}</Text> : null}
        </Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
          {tenantName ?? (unit.status === 'vacant' ? 'No tenant' : '—')}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{formatPHP(unit.monthly_rent)}</Text>
        <View style={{ backgroundColor: cfg.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: cfg.color }}>{cfg.label}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: property, isLoading } = useProperty(id);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!property) return null;

  const units = property.unit ?? [];
  const total = units.length;
  const occupied = units.filter(u => u.status === 'occupied').length;
  const vacant = units.filter(u => u.status === 'vacant').length;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{property.name}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Property info */}
        <Card style={{ marginBottom: 16 }}>
          <ListRow label="Address" value={property.address} showDivider />
          <ListRow
            label="Electric Provider"
            value={property.electric_provider ? ELECTRIC_PROVIDER[property.electric_provider] ?? property.electric_provider : 'Not set'}
            showDivider
          />
          <ListRow
            label="Default Rate"
            value={property.default_rate_per_kwh ? `₱${property.default_rate_per_kwh}/kWh` : 'Not set'}
            showDivider={false}
          />
        </Card>

        {/* Occupancy summary */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total Units', value: total, color: '#111827' },
            { label: 'Occupied', value: occupied, color: '#15803D' },
            { label: 'Vacant', value: vacant, color: '#B45309' },
            { label: 'Occupancy', value: `${occupancyPct}%`, color: PRIMARY },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: s.color }}>{s.value}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Units list */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Units</Text>
        {units.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' }}>
            <Ionicons name="home-outline" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 10 }}>No units yet</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
            {units
              .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }))
              .map(unit => (
                <UnitCard key={unit.id} unit={unit} propertyId={property.id} />
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
