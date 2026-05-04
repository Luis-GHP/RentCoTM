import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { AlertBox } from '../../../components/shared/AlertBox';
import { useActiveLeases, useRecordPayment, ActiveLease } from '../../../lib/query/payments';
import { formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

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
  const property = unit?.property?.name ? ` · ${unit.property.name}` : '';
  return `Unit ${unit?.unit_number ?? '—'}${property} — ${name}`;
}

export default function RecordPaymentScreen() {
  const router = useRouter();
  const { data: leases, isLoading } = useActiveLeases();
  const recordPayment = useRecordPayment();

  const now = new Date();
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [amountPaid, setAmountPaid] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [paymentDate] = useState(now.toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedLease = (leases ?? []).find(l => l.id === selectedLeaseId) ?? null;

  function onSelectLease(lease: ActiveLease) {
    setSelectedLeaseId(lease.id);
    setAmountPaid(String(Number(lease.monthly_rent)));
  }

  async function handleSave() {
    setError('');
    if (!selectedLease) { setError('Select a tenant first.'); return; }
    const paid = parseFloat(amountPaid);
    if (isNaN(paid) || paid <= 0) { setError('Enter a valid amount.'); return; }
    if (!method) { setError('Select a payment method.'); return; }
    if (['gcash', 'maya', 'bank'].includes(method) && !reference.trim()) {
      setError('Reference number is required for this payment method.');
      return;
    }

    setBusy(true);
    try {
      await recordPayment.mutateAsync({
        leaseId: selectedLease.id,
        periodMonth,
        periodYear,
        amountDue: Number(selectedLease.monthly_rent),
        amountPaid: paid,
        paymentMethod: method,
        referenceNumber: reference.trim(),
        paymentDate,
      });
      Alert.alert('Payment Recorded', 'The payment has been saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setError('Failed to record payment. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Record Payment</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? <AlertBox type="error" message={error} style={{ marginBottom: 16 }} /> : null}

        {/* Tenant / Unit selection */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Tenant / Unit</Text>
        {(leases ?? []).length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No active leases found</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', marginBottom: 16 }}>
            {(leases ?? []).map((lease, i) => (
              <TouchableOpacity
                key={lease.id}
                activeOpacity={0.7}
                onPress={() => onSelectLease(lease)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderBottomWidth: i < (leases!.length - 1) ? 1 : 0,
                  borderBottomColor: '#F3F4F6',
                  backgroundColor: selectedLeaseId === lease.id ? `${PRIMARY}08` : '#fff',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{leaseLabel(lease)}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatPHP(Number(lease.monthly_rent))} / mo</Text>
                </View>
                {selectedLeaseId === lease.id && (
                  <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Period */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Period</Text>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {MONTHS.map(m => (
              <TouchableOpacity
                key={m.value}
                onPress={() => setPeriodMonth(m.value)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: periodMonth === m.value ? PRIMARY : '#F3F4F6' }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: periodMonth === m.value ? '#fff' : '#6B7280' }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10, marginBottom: 6 }}>Year</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                onPress={() => setPeriodYear(y)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center', backgroundColor: periodYear === y ? PRIMARY : '#F3F4F6' }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: periodYear === y ? '#fff' : '#6B7280' }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Amount Paid (₱)</Text>
        <TextInput
          value={amountPaid}
          onChangeText={setAmountPaid}
          keyboardType="decimal-pad"
          placeholder={selectedLease ? String(Number(selectedLease.monthly_rent)) : '0.00'}
          placeholderTextColor="#9CA3AF"
          style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 16 }}
        />

        {/* Method */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Payment Method</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMethod(m.key)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: method === m.key ? PRIMARY : '#fff', borderWidth: 1, borderColor: method === m.key ? PRIMARY : '#E5E7EB' }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: method === m.key ? '#fff' : '#374151' }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reference number */}
        {['gcash', 'maya', 'bank'].includes(method) && (
          <>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Reference Number</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. 1234567890"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', marginBottom: 16 }}
            />
          </>
        )}

        {/* Date (display only) */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Payment Date</Text>
        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24 }}>
          <Text style={{ fontSize: 15, color: '#374151' }}>{new Date(paymentDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={busy}
          style={{ backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8, opacity: busy ? 0.6 : 1 }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save Payment'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
