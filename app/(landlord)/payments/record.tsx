import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
import { Button } from '../../../components/shared/Button';
import { EmptyState } from '../../../components/shared/EmptyState';
import {
  ActiveLease,
  useActiveLeases,
  useExistingRentPayment,
  useRecordPayment,
} from '../../../lib/query/payments';
import { formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#2F4A7D';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const METHODS = [
  { key: 'gcash', label: 'GCash' },
  { key: 'maya',  label: 'Maya' },
  { key: 'bank',  label: 'Bank' },
  { key: 'cash',  label: 'Cash' },
];

function tenantLabel(lease: ActiveLease): string {
  const primary = lease.lease_tenant.find(lt => lt.role === 'primary') ?? lease.lease_tenant[0];
  return primary?.tenant?.name ?? 'Unknown';
}

function leaseLabel(lease: ActiveLease): string {
  const unit = lease.unit;
  const name = tenantLabel(lease);
  const property = unit?.property?.name ? ` - ${unit.property.name}` : '';
  return `Unit ${unit?.unit_number ?? '-'}${property} - ${name}`;
}

function leaseSearchText(lease: ActiveLease): string {
  return [
    tenantLabel(lease),
    lease.unit?.unit_number,
    lease.unit?.property?.name,
    String(lease.monthly_rent),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isValidPaymentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function RecordPaymentScreen() {
  const router = useRouter();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();
  const { data: leases, isLoading } = useActiveLeases();
  const recordPayment = useRecordPayment();

  const now = new Date();
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [amountPaid, setAmountPaid] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(now.toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [savedPaymentId, setSavedPaymentId] = useState<string | null>(null);

  const selectedLease = (leases ?? []).find(l => l.id === selectedLeaseId) ?? null;
  const existingPayment = useExistingRentPayment({
    leaseId: selectedLeaseId,
    periodMonth,
    periodYear,
  });

  const filteredLeases = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leases ?? [];
    return (leases ?? []).filter(lease => leaseSearchText(lease).includes(q));
  }, [leases, search]);

  const monthlyRent = Number(selectedLease?.monthly_rent ?? 0);
  const paid = Number(amountPaid || 0);
  const remaining = Math.max(0, monthlyRent - paid);
  const isPartial = selectedLease ? paid > 0 && paid < monthlyRent : false;
  const isOverpay = selectedLease ? paid > monthlyRent : false;
  const canSave = !!selectedLease && !existingPayment.data && !existingPayment.isLoading && !recordPayment.isPending;

  useEffect(() => {
    if (selectedLeaseId || !leases) return;
    const requestedLease = leaseId ? leases.find(lease => lease.id === leaseId) : null;
    if (requestedLease) {
      onSelectLease(requestedLease);
      return;
    }
    if (leases.length === 1) onSelectLease(leases[0]);
  }, [leaseId, leases, selectedLeaseId]);

  function onSelectLease(lease: ActiveLease) {
    setSelectedLeaseId(lease.id);
    setAmountPaid(String(Number(lease.monthly_rent)));
    setError('');
  }

  async function handleSave() {
    setError('');
    if (!selectedLease) { setError('Select a tenant first.'); return; }
    const parsedPaid = parseFloat(amountPaid);
    if (isNaN(parsedPaid) || parsedPaid <= 0) { setError('Enter a valid amount.'); return; }
    if (!method) { setError('Select a payment method.'); return; }
    if (!isValidPaymentDate(paymentDate)) { setError('Use a valid payment date in YYYY-MM-DD format.'); return; }
    if (existingPayment.data) { setError('A payment already exists for this tenant and period. Open that payment instead.'); return; }
    if (['gcash', 'maya', 'bank'].includes(method) && !reference.trim()) {
      setError('Reference number is required for this payment method.');
      return;
    }

    try {
      const paymentId = await recordPayment.mutateAsync({
        leaseId: selectedLease.id,
        periodMonth,
        periodYear,
        amountDue: monthlyRent,
        amountPaid: parsedPaid,
        paymentMethod: method,
        referenceNumber: reference.trim(),
        paymentDate,
      });
      setSavedPaymentId(paymentId);
    } catch (err) {
      const message = err instanceof Error && (err.message.includes('duplicate') || err.message.includes('rent_payment_lease_id_period_month_period_year_key'))
        ? 'A payment already exists for this tenant and period. Open that payment instead.'
        : 'Failed to record payment. Please try again.';
      setError(message);
    }
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Record Payment</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Rent payment for an active lease</Text>
        </View>
      </View>

      {(leases ?? []).length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Active Leases Yet"
          subtitle="Invite or assign a tenant to a unit before recording rent payments."
          actionLabel="Invite Tenant"
          onAction={() => router.push('/(landlord)/tenants/invite')}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? <AlertBox type="error" message={error} style={{ marginBottom: 16 }} /> : null}

          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Tenant / Unit</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1EFEC', borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 10 }}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search tenant, unit, property..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {filteredLeases.length === 0 ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1EFEC', marginBottom: 16 }}>
              <Ionicons name="search-outline" size={24} color="#D1D5DB" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 8 }}>No matching leases</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, textAlign: 'center' }}>Try another tenant name, unit, or property.</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F1EFEC', overflow: 'hidden', marginBottom: 16 }}>
              {filteredLeases.map((lease, i) => (
                <TouchableOpacity
                  key={lease.id}
                  activeOpacity={0.7}
                  onPress={() => onSelectLease(lease)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: i < filteredLeases.length - 1 ? 1 : 0,
                    borderBottomColor: '#F1EFEC',
                    backgroundColor: selectedLeaseId === lease.id ? `${PRIMARY}0D` : '#fff',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{leaseLabel(lease)}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatPHP(Number(lease.monthly_rent))} / mo</Text>
                  </View>
                  {selectedLeaseId === lease.id ? (
                    <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Period</Text>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {MONTHS.map(m => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setPeriodMonth(m.value)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: periodMonth === m.value ? PRIMARY : '#F1EFEC' }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: periodMonth === m.value ? '#fff' : '#6B7280' }}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10, marginBottom: 6 }}>Year</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {YEARS.map(y => (
                <TouchableOpacity
                  key={y}
                  onPress={() => setPeriodYear(y)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center', backgroundColor: periodYear === y ? PRIMARY : '#F1EFEC' }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: periodYear === y ? '#fff' : '#6B7280' }}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {existingPayment.data ? (
            <View style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="alert-circle-outline" size={22} color="#D99A2B" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>Payment already exists</Text>
                <Text style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                  {getMonthName(periodMonth)} {periodYear} is already recorded as {existingPayment.data.status}.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/(landlord)/payments/${existingPayment.data!.id}` as any)}
                activeOpacity={0.75}
                style={{ marginLeft: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#fff' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#92400E' }}>Open</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Amount Paid</Text>
          <TextInput
            value={amountPaid}
            onChangeText={setAmountPaid}
            keyboardType="decimal-pad"
            placeholder={selectedLease ? String(Number(selectedLease.monthly_rent)) : '0.00'}
            placeholderTextColor="#9CA3AF"
            style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E4E0DC', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10 }}
          />

          {selectedLease ? (
            <View style={{ backgroundColor: isPartial ? '#FFFBEB' : '#EDF3FF', borderRadius: 14, borderWidth: 1, borderColor: isPartial ? '#FDE68A' : '#D8E2F2', padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: '#111827' }}>
                  {isPartial ? 'Partial payment' : isOverpay ? 'Over monthly rent' : 'Full payment'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: PRIMARY }}>{formatPHP(paid || 0)}</Text>
              </View>
              <Text style={{ fontSize: 12, color: isPartial ? '#B45309' : '#4B5563', marginTop: 5 }}>
                Monthly rent is {formatPHP(monthlyRent)}. {isPartial ? `${formatPHP(remaining)} will remain pending.` : isOverpay ? 'This amount is higher than the monthly rent.' : 'This will mark the period as paid.'}
              </Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Payment Method</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {METHODS.map(m => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMethod(m.key)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: method === m.key ? PRIMARY : '#fff', borderWidth: 1, borderColor: method === m.key ? PRIMARY : '#E4E0DC' }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: method === m.key ? '#fff' : '#374151' }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {['gcash', 'maya', 'bank'].includes(method) ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Reference Number</Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="e.g. 1234567890"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E4E0DC', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', marginBottom: 16 }}
              />
            </>
          ) : null}

          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Payment Date</Text>
          <TextInput
            value={paymentDate}
            onChangeText={setPaymentDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E4E0DC', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', marginBottom: 24 }}
          />

          <Button
            label={recordPayment.isPending ? 'Saving...' : 'Save Payment'}
            loading={recordPayment.isPending}
            disabled={!canSave}
            onPress={handleSave}
            style={{ marginBottom: 8 }}
          />
        </ScrollView>
      )}

      <AppModal
        visible={!!savedPaymentId}
        tone="success"
        title="Payment Recorded"
        message="The payment has been saved successfully."
        confirmLabel="View Payment"
        onConfirm={() => {
          const paymentId = savedPaymentId;
          setSavedPaymentId(null);
          if (paymentId) router.replace(`/(landlord)/payments/${paymentId}` as any);
        }}
      />
    </SafeAreaView>
  );
}
