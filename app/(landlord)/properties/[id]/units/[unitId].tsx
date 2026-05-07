import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '../../../../../components/shared/LoadingSpinner';
import { Card } from '../../../../../components/shared/Card';
import { ListRow } from '../../../../../components/shared/ListRow';
import { Avatar } from '../../../../../components/shared/Avatar';
import { AlertBox } from '../../../../../components/shared/AlertBox';
import { Button } from '../../../../../components/shared/Button';
import { EntityDocumentsCard } from '../../../../../components/documents/EntityDocumentsCard';
import {
  UnitDetail,
  UnitStatus,
  UnitType,
  useUnit,
  useUnitCurrentRentPayment,
  useUnitPaymentHistory,
  useUnitUtilityBillHistory,
  useUpdateUnit,
  useUpdateUnitStatus,
} from '../../../../../lib/query/properties';
import { formatPHP, formatDate, getMonthName } from '../../../../../lib/format';

const PRIMARY = '#2F4A7D';

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
  occupied:          { color: '#14804A', bg: '#EAF7EF', label: 'Occupied',          icon: 'checkmark-circle' },
  vacant:            { color: '#B45309', bg: '#FFFBEB', label: 'Vacant',            icon: 'key-outline' },
  under_maintenance: { color: '#2F4A7D', bg: '#EDF3FF', label: 'Under Maintenance', icon: 'construct-outline' },
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

const STATUS_OPTIONS: { key: UnitStatus; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'vacant', label: 'Vacant', detail: 'Available for tenant invite', icon: 'key-outline' },
  { key: 'occupied', label: 'Occupied', detail: 'Used when an active lease exists', icon: 'checkmark-circle' },
  { key: 'under_maintenance', label: 'Under Maintenance', detail: 'Temporarily unavailable for move-in', icon: 'construct-outline' },
];

function currentPeriodLabel() {
  const now = new Date();
  return `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;
}

function rentPill(payment: { status: string; amount_due: number; amount_paid: number } | null | undefined, loading: boolean) {
  if (loading) return { label: 'Checking Rent', detail: currentPeriodLabel(), color: '#6B7280', bg: '#F7F6F3' };
  if (!payment) return { label: 'No Rent Record', detail: currentPeriodLabel(), color: '#B45309', bg: '#FFFBEB' };
  if (payment.status === 'paid') return { label: 'Paid', detail: currentPeriodLabel(), color: '#14804A', bg: '#EAF7EF' };
  if (payment.status === 'partial') {
    const balance = Math.max(0, Number(payment.amount_due) - Number(payment.amount_paid));
    return { label: 'Partial', detail: `${formatPHP(balance)} left`, color: '#B45309', bg: '#FFFBEB' };
  }
  if (payment.status === 'overdue') return { label: 'Overdue', detail: currentPeriodLabel(), color: '#DC2626', bg: '#FEF2F2' };
  if (payment.status === 'pending') return { label: 'Pending', detail: currentPeriodLabel(), color: '#2F4A7D', bg: '#EDF3FF' };
  return { label: 'Unpaid', detail: currentPeriodLabel(), color: '#6B7280', bg: '#F7F6F3' };
}

const UTILITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  electric: 'flash-outline',
  water: 'water-outline',
  internet: 'wifi-outline',
  other: 'receipt-outline',
};

function EditUnitModal({
  visible,
  unit,
  hasActiveLease,
  onClose,
}: {
  visible: boolean;
  unit: UnitDetail;
  hasActiveLease: boolean;
  onClose: () => void;
}) {
  const updateUnit = useUpdateUnit();
  const [unitNumber, setUnitNumber] = useState(unit.unit_number);
  const [unitType, setUnitType] = useState<UnitType>((unit.type ?? 'studio') as UnitType);
  const [floor, setFloor] = useState(unit.floor ?? '');
  const [monthlyRent, setMonthlyRent] = useState(String(unit.monthly_rent));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setUnitNumber(unit.unit_number);
    setUnitType((unit.type ?? 'studio') as UnitType);
    setFloor(unit.floor ?? '');
    setMonthlyRent(String(unit.monthly_rent));
    setError('');
  }, [visible, unit]);

  const selectedType = UNIT_TYPE_OPTIONS.find(option => option.key === unitType) ?? UNIT_TYPE_OPTIONS[0];

  async function save() {
    setError('');
    if (!unitNumber.trim()) { setError('Unit number is required.'); return; }
    const rent = Number(monthlyRent);
    if (!Number.isFinite(rent) || rent <= 0) { setError('Monthly rent must be greater than zero.'); return; }

    try {
      await updateUnit.mutateAsync({
        unitId: unit.id,
        propertyId: unit.property?.id,
        unitNumber,
        type: unitType,
        floor: floor || null,
        monthlyRent: rent,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error && err.message.includes('duplicate')
        ? 'A unit with this number already exists for this property.'
        : 'Could not update this unit right now.';
      setError(message);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.35)' }}>
        <View style={{ backgroundColor: '#F7F6F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingBottom: 24 }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Edit Unit</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEC' }}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? <AlertBox type="error" message={error} /> : null}
            {hasActiveLease ? (
              <AlertBox
                type="info"
                message="Changing monthly rent here updates the unit default for future leases. This active lease keeps its signed rent."
                style={{ marginBottom: 16 }}
              />
            ) : null}

            <UnitField label="Unit Number" value={unitNumber} onChange={setUnitNumber} placeholder={selectedType.placeholder} />

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

            <UnitField label="Floor" value={floor} onChange={setFloor} placeholder="Optional" />
            <UnitField label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} placeholder="0.00" keyboardType="decimal-pad" />

            <Button label="Save Changes" loading={updateUnit.isPending} onPress={save} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function UnitStatusModal({
  visible,
  unit,
  hasActiveLease,
  onClose,
}: {
  visible: boolean;
  unit: UnitDetail;
  hasActiveLease: boolean;
  onClose: () => void;
}) {
  const updateStatus = useUpdateUnitStatus();
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) setError('');
  }, [visible]);

  async function choose(status: UnitStatus) {
    setError('');
    if (status === unit.status) return;
    if (status === 'vacant' && hasActiveLease) {
      setError('This unit has an active lease. End or change the lease before marking it vacant.');
      return;
    }
    if (status === 'occupied' && !hasActiveLease) {
      setError('Invite or assign a tenant first so occupied status has a real lease behind it.');
      return;
    }

    try {
      await updateStatus.mutateAsync({ unitId: unit.id, propertyId: unit.property?.id, status });
      onClose();
    } catch {
      setError('Could not update this unit status right now.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Change Unit Status</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 6, marginBottom: 14, lineHeight: 21 }}>
            Keep occupancy tied to leases. Use under maintenance when a vacant or occupied unit is temporarily unavailable.
          </Text>
          {error ? <AlertBox type="error" message={error} style={{ marginBottom: 14 }} /> : null}

          <View style={{ gap: 8, marginBottom: 16 }}>
            {STATUS_OPTIONS.map(option => {
              const cfg = STATUS_CONFIG[option.key];
              const active = unit.status === option.key;
              const blocked = (option.key === 'vacant' && hasActiveLease) || (option.key === 'occupied' && !hasActiveLease);
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => choose(option.key)}
                  activeOpacity={0.75}
                  disabled={updateStatus.isPending}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 13,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? cfg.color : '#E4E0DC',
                    backgroundColor: active ? cfg.bg : '#fff',
                    opacity: blocked && !active ? 0.55 : 1,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={option.icon} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: active ? cfg.color : '#111827' }}>{option.label}</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{option.detail}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={cfg.color} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <Button label="Done" variant="secondary" disabled={updateStatus.isPending} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function UnitField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
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
        style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E4E0DC', height: 52, paddingHorizontal: 16, color: '#111827', fontSize: 15 }}
      />
    </View>
  );
}

export default function UnitDetailScreen() {
  const { unitId } = useLocalSearchParams<{ id: string; unitId: string }>();
  const router = useRouter();
  const { data: unit, isLoading } = useUnit(unitId);
  const activeLease = unit?.lease.find(l => l.status === 'active') ?? null;
  const { data: currentRent, isLoading: isRentLoading } = useUnitCurrentRentPayment(activeLease?.id);
  const { data: recentPayments } = useUnitPaymentHistory(activeLease?.id);
  const { data: recentUtilities } = useUnitUtilityBillHistory(unit?.id);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!unit) return null;

  const primaryTenant = activeLease?.lease_tenant.find(lt => lt.role === 'primary')?.tenant ?? null;
  const coTenants = activeLease?.lease_tenant.filter(lt => lt.role !== 'primary') ?? [];
  const cfg = STATUS_CONFIG[unit.status] ?? { color: '#6B7280', bg: '#F7F6F3', label: unit.status, icon: 'home-outline' as const };
  const rentStatus = activeLease ? rentPill(currentRent, isRentLoading) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Unit {unit.unit_number}</Text>
          {unit.property && (
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unit.property.name}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setIsEditOpen(true)} activeOpacity={0.8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="create-outline" size={19} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <TouchableOpacity
          onPress={() => setIsStatusOpen(true)}
          activeOpacity={0.78}
          style={{ backgroundColor: cfg.bg, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: cfg.color + '30' }}
        >
          <Ionicons name={cfg.icon} size={24} color={cfg.color} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
            {unit.type && (
              <Text style={{ fontSize: 12, color: cfg.color, opacity: 0.8, marginTop: 2 }}>
                {UNIT_TYPE[unit.type] ?? unit.type}{unit.floor ? ` - Floor ${unit.floor}` : ''}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{formatPHP(unit.monthly_rent)}</Text>
            <Text style={{ fontSize: 11, color: '#6B7280' }}>per month</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={cfg.color} style={{ marginLeft: 8, opacity: 0.65 }} />
        </TouchableOpacity>

        {rentStatus ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: rentStatus.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="receipt-outline" size={18} color={rentStatus.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>Current Rent</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{rentStatus.detail}</Text>
            </View>
            <View style={{ backgroundColor: rentStatus.bg, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: rentStatus.color }}>{rentStatus.label}</Text>
            </View>
          </View>
        ) : null}

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
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1EFEC' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Co-tenants</Text>
                {coTenants.map(ct => ct.tenant && (
                  <Text key={ct.tenant.id} style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>{ct.tenant.name}</Text>
                ))}
              </View>
            )}
          </Card>
        ) : unit.status === 'vacant' ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#F1EFEC' }}>
            <Ionicons name="person-add-outline" size={36} color="#D1D5DB" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 10 }}>No tenant</Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Invite a tenant to link them to this unit.</Text>
            <TouchableOpacity
              onPress={() => router.push(`/(landlord)/tenants/invite?unitId=${unit.id}`)}
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
            {primaryTenant ? (
              <TouchableOpacity
                onPress={() => router.push(`/(landlord)/tenants/${primaryTenant.id}/rent-increase` as any)}
                activeOpacity={0.8}
                style={{ marginTop: 14, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D8E2F2', backgroundColor: '#F8FCFA' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: PRIMARY }}>Review Rent Increase</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        )}

        <EntityDocumentsCard
          entityType="unit"
          entityId={unit.id}
          title="Unit Files"
          emptyText="Upload unit photos, inspection notes, or other files tied to this unit."
        />

        {activeLease ? (
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' }}>Recent Rent</Text>
              <TouchableOpacity
                onPress={() => router.push(`/(landlord)/payments/record?leaseId=${activeLease.id}` as any)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: PRIMARY }}>Record</Text>
              </TouchableOpacity>
            </View>
            {(recentPayments ?? []).length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Ionicons name="receipt-outline" size={28} color="#D1D5DB" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 8 }}>No rent payments yet</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, textAlign: 'center' }}>Recorded payments for this unit will appear here.</Text>
              </View>
            ) : recentPayments!.map((payment, index) => (
              <TouchableOpacity
                key={payment.id}
                onPress={() => router.push(`/(landlord)/payments/${payment.id}` as any)}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < recentPayments!.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="receipt-outline" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{getMonthName(payment.period_month)} {payment.period_year}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatPHP(payment.amount_paid)} paid of {formatPHP(payment.amount_due)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#374151', marginBottom: 4 }}>{payment.or_number ?? 'No OR'}</Text>
                  <View style={{ borderRadius: 16, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: payment.status === 'paid' ? '#EAF7EF' : '#FFFBEB' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: payment.status === 'paid' ? '#14804A' : '#B45309', textTransform: 'capitalize' }}>{payment.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        ) : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' }}>Recent Utilities</Text>
            <TouchableOpacity
              onPress={() => router.push(`/(landlord)/utilities/upload?unitId=${unit.id}` as any)}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: PRIMARY }}>Upload</Text>
            </TouchableOpacity>
          </View>
          {(recentUtilities ?? []).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 18 }}>
              <Ionicons name="flash-outline" size={28} color="#D1D5DB" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 8 }}>No utility bills yet</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, textAlign: 'center' }}>Uploaded utility bills for this unit will appear here.</Text>
            </View>
          ) : recentUtilities!.map((bill, index) => (
            <TouchableOpacity
              key={bill.id}
              onPress={() => router.push(`/(landlord)/utilities/${bill.id}` as any)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < recentUtilities!.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={UTILITY_ICON[bill.utility_type] ?? 'receipt-outline'} size={18} color="#374151" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', textTransform: 'capitalize' }}>{bill.utility_type} - {getMonthName(bill.period_month)} {bill.period_year}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{bill.provider}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 4 }}>{formatPHP(bill.amount)}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: bill.confirmed_at && bill.status === 'paid' ? '#14804A' : '#B45309', textTransform: 'capitalize' }}>
                  {bill.confirmed_at ? bill.status : 'Pending'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Quick actions */}
        {activeLease && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => router.push(`/(landlord)/payments/record?leaseId=${activeLease.id}` as any)}
              style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              activeOpacity={0.85}
            >
              <Ionicons name="cash-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Record Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/(landlord)/maintenance?unitId=${unit.id}`)}
              style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#E4E0DC' }}
              activeOpacity={0.8}
            >
              <Ionicons name="construct-outline" size={18} color="#374151" />
              <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>Maintenance</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.push(`/(landlord)/utilities/upload?unitId=${unit.id}` as any)}
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#E4E0DC' }}
            activeOpacity={0.8}
          >
            <Ionicons name="flash-outline" size={18} color="#374151" />
            <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>Upload Utility</Text>
          </TouchableOpacity>
          {!activeLease ? (
            <TouchableOpacity
              onPress={() => router.push(`/(landlord)/maintenance?unitId=${unit.id}` as any)}
              style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#E4E0DC' }}
              activeOpacity={0.8}
            >
              <Ionicons name="construct-outline" size={18} color="#374151" />
              <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>Maintenance</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
      <EditUnitModal visible={isEditOpen} unit={unit} hasActiveLease={!!activeLease} onClose={() => setIsEditOpen(false)} />
      <UnitStatusModal visible={isStatusOpen} unit={unit} hasActiveLease={!!activeLease} onClose={() => setIsStatusOpen(false)} />
    </SafeAreaView>
  );
}
