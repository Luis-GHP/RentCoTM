import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '../../../../components/shared/LoadingSpinner';
import { Card } from '../../../../components/shared/Card';
import { ListRow } from '../../../../components/shared/ListRow';
import { AlertBox } from '../../../../components/shared/AlertBox';
import { Button } from '../../../../components/shared/Button';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { EntityDocumentsCard } from '../../../../components/documents/EntityDocumentsCard';
import {
  ElectricProvider,
  PropertyDetail,
  PropertyType,
  useCreateUnit,
  useProperty,
  usePropertyIncomeSummary,
  useUpdateProperty,
  UnitSummary,
  UnitType,
} from '../../../../lib/query/properties';
import { formatPHP, getMonthName } from '../../../../lib/format';

const PRIMARY = '#2F4A7D';

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

const UNIT_TYPE_OPTIONS: { key: UnitType; label: string; placeholder: string }[] = [
  { key: 'studio', label: 'Studio', placeholder: 'e.g. 101' },
  { key: '1br', label: '1 BR', placeholder: 'e.g. 201' },
  { key: '2br', label: '2 BR', placeholder: 'e.g. 301' },
  { key: '3br', label: '3 BR', placeholder: 'e.g. 401' },
  { key: 'room', label: 'Room', placeholder: 'e.g. Room A' },
  { key: 'bedspace', label: 'Bedspace', placeholder: 'e.g. Bedspace 1' },
  { key: 'whole_unit', label: 'Whole Unit', placeholder: 'e.g. Main House' },
];

const PROPERTY_TYPE: Record<string, string> = {
  apartment: 'Apartment',
  house: 'House',
  condo: 'Condo',
  boarding_house: 'Boarding House',
  commercial: 'Commercial',
};

const PROPERTY_TYPE_OPTIONS: { key: PropertyType; label: string }[] = [
  { key: 'apartment', label: 'Apartment' },
  { key: 'house', label: 'House' },
  { key: 'condo', label: 'Condo' },
  { key: 'boarding_house', label: 'Boarding House' },
  { key: 'commercial', label: 'Commercial' },
];

const PROVIDER_OPTIONS: { key: ElectricProvider; label: string; hint: string }[] = [
  { key: 'meralco', label: 'Meralco', hint: 'Approx. PHP 11/kWh' },
  { key: 'veco', label: 'VECO', hint: 'Approx. PHP 10/kWh' },
  { key: 'dlpc', label: 'DLPC', hint: 'Approx. PHP 10/kWh' },
  { key: 'beneco', label: 'BENECO', hint: 'Approx. PHP 9/kWh' },
  { key: 'neeco', label: 'NEECO', hint: 'Approx. PHP 11/kWh' },
  { key: 'manual', label: 'Manual', hint: '' },
];

const UNIT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  occupied:          { color: '#14804A', bg: '#EAF7EF', label: 'Occupied' },
  vacant:            { color: '#B45309', bg: '#FFFBEB', label: 'Vacant' },
  under_maintenance: { color: '#2F4A7D', bg: '#EDF3FF', label: 'Under Maintenance' },
};

function activeTenantName(unit: UnitSummary): string | null {
  const activeLease = unit.lease.find(l => l.status === 'active');
  if (!activeLease) return null;
  const primary = activeLease.lease_tenant.find(lt => lt.role === 'primary') ?? activeLease.lease_tenant[0];
  return primary?.tenant?.name ?? null;
}

function UnitCard({ unit, propertyId }: { unit: UnitSummary; propertyId: string }) {
  const router = useRouter();
  const cfg = UNIT_STATUS_CONFIG[unit.status] ?? { color: '#6B7280', bg: '#F7F6F3', label: unit.status };
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
        borderBottomColor: '#F1EFEC',
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <Ionicons name="home-outline" size={20} color={cfg.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
          Unit {unit.unit_number}
          {unit.type ? <Text style={{ fontWeight: '400', color: '#6B7280' }}> - {UNIT_TYPE[unit.type] ?? unit.type}</Text> : null}
        </Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
          {tenantName ?? (unit.status === 'vacant' ? 'No tenant' : '—')}
        </Text>
        {unit.openMaintenanceCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
            <Ionicons name="construct-outline" size={12} color="#B45309" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>
              {unit.openMaintenanceCount} open maintenance
            </Text>
          </View>
        ) : null}
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

function IncomeMetric({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexBasis: '48%', backgroundColor: '#F7F6F3', borderRadius: 12, padding: 12, minHeight: 72 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '900', color, marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </Text>
    </View>
  );
}

function EditPropertyModal({
  visible,
  property,
  onClose,
}: {
  visible: boolean;
  property: PropertyDetail;
  onClose: () => void;
}) {
  const updateProperty = useUpdateProperty();
  const [name, setName] = useState(property.name);
  const [address, setAddress] = useState(property.address);
  const [propertyType, setPropertyType] = useState<PropertyType>(property.type);
  const [electricProvider, setElectricProvider] = useState<ElectricProvider>((property.electric_provider ?? 'manual') as ElectricProvider);
  const [rate, setRate] = useState(property.default_rate_per_kwh ? String(property.default_rate_per_kwh) : '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(property.name);
    setAddress(property.address);
    setPropertyType(property.type);
    setElectricProvider((property.electric_provider ?? 'manual') as ElectricProvider);
    setRate(property.default_rate_per_kwh ? String(property.default_rate_per_kwh) : '');
    setError('');
  }, [visible, property]);

  const requiresRate = electricProvider !== 'manual';
  const selectedProvider = PROVIDER_OPTIONS.find(provider => provider.key === electricProvider) ?? PROVIDER_OPTIONS[0];

  async function save() {
    setError('');
    if (!name.trim()) { setError('Property name is required.'); return; }
    if (!address.trim()) { setError('Address is required.'); return; }

    const parsedRate = rate.trim() ? Number(rate) : null;
    if (requiresRate && (!parsedRate || parsedRate <= 0)) {
      setError('Average rate per kWh is required for this provider.');
      return;
    }
    if (parsedRate !== null && parsedRate <= 0) {
      setError('Average rate per kWh must be greater than zero.');
      return;
    }

    try {
      await updateProperty.mutateAsync({
        propertyId: property.id,
        name,
        address,
        type: propertyType,
        electricProvider,
        defaultRatePerKwh: requiresRate ? parsedRate : null,
      });
      onClose();
    } catch {
      setError('Could not update this property right now.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.35)' }}>
        <View style={{ backgroundColor: '#F7F6F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 24 }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Edit Property</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEC' }}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? <AlertBox type="error" message={error} /> : null}

            <Field label="Property Name" value={name} onChange={setName} placeholder="Name shown in RentCo" />
            <Field label="Address" value={address} onChange={setAddress} placeholder="Street, city, province" multiline />

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Property Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PROPERTY_TYPE_OPTIONS.map(option => {
                const selected = propertyType === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setPropertyType(option.key)}
                    activeOpacity={0.75}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: selected ? PRIMARY : '#fff', borderWidth: 1, borderColor: selected ? PRIMARY : '#E4E0DC' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : '#374151' }}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Electric Provider</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PROVIDER_OPTIONS.map(provider => {
                const selected = electricProvider === provider.key;
                return (
                  <TouchableOpacity
                    key={provider.key}
                    onPress={() => {
                      setElectricProvider(provider.key);
                      if (provider.key === 'manual') setRate('');
                    }}
                    activeOpacity={0.75}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: selected ? PRIMARY : '#fff', borderWidth: 1, borderColor: selected ? PRIMARY : '#E4E0DC' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : '#374151' }}>{provider.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {requiresRate ? (
              <Field
                label="Average Rate per kWh"
                value={rate}
                onChange={setRate}
                placeholder={selectedProvider.hint}
                keyboardType="decimal-pad"
              />
            ) : null}

            <Button label="Save Changes" loading={updateProperty.isPending} onPress={save} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AddUnitModal({
  visible,
  propertyId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  propertyId: string;
  onClose: () => void;
  onCreated: (unitId: string) => void;
}) {
  const createUnit = useCreateUnit();
  const [unitNumber, setUnitNumber] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('studio');
  const [floor, setFloor] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [error, setError] = useState('');

  const selectedType = UNIT_TYPE_OPTIONS.find(option => option.key === unitType) ?? UNIT_TYPE_OPTIONS[0];

  function resetAndClose() {
    setUnitNumber('');
    setUnitType('studio');
    setFloor('');
    setMonthlyRent('');
    setError('');
    onClose();
  }

  async function save() {
    setError('');
    if (!unitNumber.trim()) { setError('Unit number is required.'); return; }
    const rent = Number(monthlyRent);
    if (!Number.isFinite(rent) || rent <= 0) { setError('Monthly rent must be greater than zero.'); return; }

    try {
      const unitId = await createUnit.mutateAsync({
        propertyId,
        unitNumber,
        type: unitType,
        floor: floor || null,
        monthlyRent: rent,
      });
      resetAndClose();
      onCreated(unitId);
    } catch (err) {
      const message = err instanceof Error && err.message.includes('duplicate')
        ? 'A unit with this number already exists for this property.'
        : 'Could not add this unit right now.';
      setError(message);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.35)' }}>
        <View style={{ backgroundColor: '#F7F6F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingBottom: 24 }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Add Unit</Text>
            <TouchableOpacity onPress={resetAndClose} activeOpacity={0.7} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEC' }}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? <AlertBox type="error" message={error} /> : null}

            <Field
              label="Unit Number"
              value={unitNumber}
              onChange={setUnitNumber}
              placeholder={selectedType.placeholder}
            />

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Unit Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {UNIT_TYPE_OPTIONS.map(option => {
                const selected = unitType === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setUnitType(option.key)}
                    activeOpacity={0.75}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: selected ? PRIMARY : '#fff', borderWidth: 1, borderColor: selected ? PRIMARY : '#E4E0DC' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : '#374151' }}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field label="Floor" value={floor} onChange={setFloor} placeholder="Optional" />
            <Field label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} placeholder="0.00" keyboardType="decimal-pad" />

            <Button label="Save Unit" loading={createUnit.isPending} onPress={save} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          backgroundColor: '#fff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#E4E0DC',
          minHeight: multiline ? 96 : 52,
          paddingHorizontal: 16,
          paddingTop: multiline ? 14 : 0,
          paddingBottom: multiline ? 14 : 0,
          color: '#111827',
          fontSize: 15,
        }}
      />
    </View>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: property, isLoading, error } = useProperty(id);
  const { data: income } = usePropertyIncomeSummary(id);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isEditPropertyOpen, setIsEditPropertyOpen] = useState(false);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !property) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Property</Text>
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't Load Property"
          subtitle="Go back and try opening the property again."
          actionLabel="Back to Properties"
          onAction={() => router.replace('/(landlord)/properties')}
        />
      </SafeAreaView>
    );
  }

  const units = property.unit ?? [];
  const total = units.length;
  const occupied = units.filter(u => u.status === 'occupied').length;
  const vacant = units.filter(u => u.status === 'vacant').length;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{property.name}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{PROPERTY_TYPE[property.type] ?? property.type}</Text>
        </View>
        <TouchableOpacity onPress={() => setIsEditPropertyOpen(true)} activeOpacity={0.8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
          <Ionicons name="create-outline" size={19} color="#374151" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsAddUnitOpen(true)} activeOpacity={0.8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
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
            value={property.default_rate_per_kwh ? `${formatPHP(Number(property.default_rate_per_kwh))}/kWh` : 'Not set'}
            showDivider={false}
          />
        </Card>

        <EntityDocumentsCard
          entityType="property"
          entityId={property.id}
          title="Property Files"
          emptyText="Upload permits, contracts, reference photos, or other property files."
        />

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Income This Month</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {income ? `${getMonthName(income.periodMonth)} ${income.periodYear}` : 'Current period'}
              </Text>
            </View>
            <View style={{ backgroundColor: '#EDF3FF', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: PRIMARY }}>{income?.activeLeaseCount ?? 0} active leases</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <IncomeMetric label="Expected" value={formatPHP(income?.expectedRent ?? 0)} />
            <IncomeMetric label="Collected" value={formatPHP(income?.collected ?? 0)} color="#14804A" />
            <IncomeMetric label="Pending" value={formatPHP(income?.pending ?? 0)} color="#B45309" />
            <IncomeMetric label="Overdue" value={formatPHP(income?.overdue ?? 0)} color="#DC2626" />
          </View>
        </Card>

        {/* Occupancy summary */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          {[
            { label: 'Total Units', value: total, color: '#111827' },
            { label: 'Occupied', value: occupied, color: '#14804A' },
            { label: 'Vacant', value: vacant, color: '#B45309' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F1EFEC' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: s.color }}>{s.value}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>
        {total > 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1EFEC', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#374151' }}>{occupied} of {total} occupied</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: PRIMARY }}>{occupancyPct}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#E4E0DC', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${occupancyPct}%`, height: 6, backgroundColor: PRIMARY, borderRadius: 3 }} />
            </View>
          </View>
        ) : null}

        {/* Units list */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Units</Text>
        {units.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', minHeight: 260 }}>
            <EmptyState
              icon="home-outline"
              title="No Units Yet"
              subtitle="Add your first unit so you can invite tenants, track rent, and log maintenance."
              actionLabel="Add Unit"
              onAction={() => setIsAddUnitOpen(true)}
            />
          </View>
        ) : (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', overflow: 'hidden' }}>
            {units
              .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }))
              .map(unit => (
                <UnitCard key={unit.id} unit={unit} propertyId={property.id} />
              ))}
          </View>
        )}
      </ScrollView>

      <AddUnitModal
        visible={isAddUnitOpen}
        propertyId={property.id}
        onClose={() => setIsAddUnitOpen(false)}
        onCreated={unitId => router.push(`/(landlord)/properties/${property.id}/units/${unitId}`)}
      />
      <EditPropertyModal
        visible={isEditPropertyOpen}
        property={property}
        onClose={() => setIsEditPropertyOpen(false)}
      />
    </SafeAreaView>
  );
}
