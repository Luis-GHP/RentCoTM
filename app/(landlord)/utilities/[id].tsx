import { View, Text, TouchableOpacity, ScrollView, Alert, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useConfirmUtilityBill, useUpdateUtilityBill, useUtilityBill } from '../../../lib/query/utilities';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

const UTILITY_TYPES = ['electric', 'water', 'internet', 'other'] as const;

export default function UtilityBillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: bill, isLoading, error } = useUtilityBill(id);
  const confirmBill = useConfirmUtilityBill();
  const updateBill = useUpdateUtilityBill();
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState('');
  const [utilityType, setUtilityType] = useState('electric');
  const [periodMonth, setPeriodMonth] = useState('');
  const [periodYear, setPeriodYear] = useState('');
  const [kwhConsumed, setKwhConsumed] = useState('');
  const [ratePerKwh, setRatePerKwh] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!bill) return;
    setProvider(bill.provider);
    setUtilityType(bill.utility_type);
    setPeriodMonth(String(bill.period_month));
    setPeriodYear(String(bill.period_year));
    setKwhConsumed(bill.kwh_consumed == null ? '' : String(bill.kwh_consumed));
    setRatePerKwh(bill.rate_per_kwh == null ? '' : String(bill.rate_per_kwh));
    setAmount(String(bill.amount));
  }, [bill]);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !bill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load utility bill right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentBill = bill;
  const unitLabel = `Unit ${currentBill.unit?.unit_number ?? '-'}${currentBill.unit?.property?.name ? ` - ${currentBill.unit.property.name}` : ''}`;
  const isConfirmed = !!currentBill.confirmed_at;

  function confirm() {
    Alert.alert('Confirm Bill', 'Confirm this utility bill? Tenant-uploaded bills will be marked as reviewed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await confirmBill.mutateAsync(currentBill.id);
          } catch {
            Alert.alert('Error', 'Could not confirm this bill.');
          }
        },
      },
    ]);
  }

  async function saveEdits() {
    setFormError('');
    const month = Number(periodMonth);
    const year = Number(periodYear);
    const total = Number(amount);
    if (!provider.trim()) { setFormError('Provider is required.'); return; }
    if (!month || month < 1 || month > 12) { setFormError('Period month must be 1 to 12.'); return; }
    if (!year || year < 2000) { setFormError('Enter a valid period year.'); return; }
    if (!total || total <= 0) { setFormError('Enter a valid amount.'); return; }

    try {
      await updateBill.mutateAsync({
        id: currentBill.id,
        provider: provider.trim(),
        utilityType,
        periodMonth: month,
        periodYear: year,
        kwhConsumed: kwhConsumed ? Number(kwhConsumed) : null,
        ratePerKwh: ratePerKwh ? Number(ratePerKwh) : null,
        amount: total,
      });
      setEditing(false);
    } catch {
      setFormError('Could not update this bill.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Utility Bill</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unitLabel}</Text>
        </View>
        <StatusBadge status={isConfirmed ? 'confirmed' : 'pending'} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {bill.uploaded_by === 'tenant' && !isConfirmed ? (
          <AlertBox type="warning" message="Uploaded by tenant. Pending your review." />
        ) : null}
        {formError ? <AlertBox type="error" message={formError} /> : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' }}>Bill Info</Text>
            {!isConfirmed && (
              <TouchableOpacity onPress={() => setEditing(value => !value)} activeOpacity={0.7}>
                <Ionicons name={editing ? 'close-outline' : 'pencil-outline'} size={22} color={PRIMARY} />
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                {UTILITY_TYPES.map(type => (
                  <TouchableOpacity key={type} onPress={() => setUtilityType(type)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: utilityType === type ? PRIMARY : '#F3F4F6' }} activeOpacity={0.75}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: utilityType === type ? '#fff' : '#6B7280', textTransform: 'capitalize' }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput value={provider} onChangeText={setProvider} placeholder="Provider" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput value={periodMonth} onChangeText={setPeriodMonth} placeholder="Month" keyboardType="number-pad" placeholderTextColor="#9CA3AF" style={{ flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
                <TextInput value={periodYear} onChangeText={setPeriodYear} placeholder="Year" keyboardType="number-pad" placeholderTextColor="#9CA3AF" style={{ flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              </View>
              <TextInput value={kwhConsumed} onChangeText={setKwhConsumed} placeholder="kWh consumed" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              <TextInput value={ratePerKwh} onChangeText={setRatePerKwh} placeholder="Rate per kWh" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 12, color: '#111827' }} />
              <Button label="Save Changes" loading={updateBill.isPending} onPress={saveEdits} />
            </>
          ) : (
            <>
              <ListRow label="Type" value={bill.utility_type.replace('_', ' ')} showDivider />
              <ListRow label="Provider" value={bill.provider} showDivider />
              <ListRow label="Period" value={`${getMonthName(bill.period_month)} ${bill.period_year}`} showDivider />
              <ListRow label="kWh Consumed" value={bill.kwh_consumed == null ? 'Not set' : `${bill.kwh_consumed} kWh`} showDivider />
              <ListRow label="Rate per kWh" value={bill.rate_per_kwh == null ? 'Not set' : formatPHP(bill.rate_per_kwh)} showDivider />
              <ListRow label="Amount" value={formatPHP(bill.amount)} showDivider={false} />
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Source</Text>
          <ListRow label="Uploaded By" value={bill.uploaded_by === 'tenant' ? 'Tenant' : 'Landlord'} showDivider />
          {bill.bill_pdf_url ? (
            <TouchableOpacity onPress={() => Linking.openURL(bill.bill_pdf_url!)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#374151' }}>View Original Bill</Text>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 14, color: '#9CA3AF', paddingTop: 12 }}>No PDF uploaded</Text>
          )}
        </Card>

        {isConfirmed ? (
          <Card>
            <ListRow label="Confirmed By" value="Landlord" showDivider />
            <ListRow label="Confirmed At" value={formatDate(bill.confirmed_at)} showDivider={false} />
          </Card>
        ) : (
          <Button label="Confirm Bill" loading={confirmBill.isPending} onPress={confirm} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
