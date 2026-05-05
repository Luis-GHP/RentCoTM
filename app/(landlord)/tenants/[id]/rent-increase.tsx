import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertBox } from '../../../../components/shared/AlertBox';
import { Button } from '../../../../components/shared/Button';
import { Card } from '../../../../components/shared/Card';
import { LoadingSpinner } from '../../../../components/shared/LoadingSpinner';
import { useRecordRentIncrease, useTenantDetail } from '../../../../lib/query/tenants';
import { formatPHP } from '../../../../lib/format';

function firstOfNextMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
}

export default function RentIncreaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useTenantDetail(id);
  const recordRentIncrease = useRecordRentIncrease();
  const [newRent, setNewRent] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(firstOfNextMonth());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const lease = data?.activeLease;
  const currentRent = Number(lease?.monthly_rent ?? 0);
  const parsedRent = Number(newRent);
  const increasePct = useMemo(() => {
    if (!currentRent || !parsedRent) return 0;
    return ((parsedRent - currentRent) / currentRent) * 100;
  }, [currentRent, parsedRent]);
  const exceedsCap = !!lease?.is_rent_controlled && increasePct > 7;

  async function submit() {
    setError('');
    if (!lease) { setError('No active lease found.'); return; }
    if (!parsedRent || parsedRent <= 0) { setError('Enter a valid new rent amount.'); return; }
    if (!effectiveDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setError('Use date format YYYY-MM-DD.'); return; }

    const run = async () => {
      try {
        await recordRentIncrease.mutateAsync({
          leaseId: lease.id,
          newRent: parsedRent,
          effectiveDate,
          reason,
        });
        Alert.alert('Rent Increase Recorded', 'The lease rent was updated and the increase history was saved.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        setError('Could not record the rent increase.');
      }
    };

    if (exceedsCap) {
      Alert.alert(
        'RA 9653 Warning',
        'This exceeds the 7% annual cap under RA 9653. You may still proceed but should consult DHSUD.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: run },
        ]
      );
      return;
    }

    run();
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Rent Increase</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            {data?.tenant.name ?? 'Tenant'}{lease?.unit?.unit_number ? ` - Unit ${lease.unit.unit_number}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {error ? <AlertBox type="error" message={error} /> : null}
        {exceedsCap ? (
          <AlertBox type="warning" message="This exceeds the 7% annual cap under RA 9653. You may still proceed but should consult DHSUD." />
        ) : null}

        {!lease ? (
          <Card>
            <Text style={{ fontSize: 15, color: '#6B7280' }}>No active lease found for this tenant.</Text>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>Current Rent</Text>
              <Text style={{ fontSize: 30, fontWeight: '800', color: '#111827' }}>{formatPHP(currentRent)}</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Frozen lease value. This does not read from the unit rate.</Text>
            </Card>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>New Rent</Text>
            <TextInput
              value={newRent}
              onChangeText={setNewRent}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', height: 52, paddingHorizontal: 16, fontSize: 16, color: '#111827', marginBottom: 10 }}
            />

            <View style={{ backgroundColor: parsedRent ? (increasePct <= 7 ? '#F0FDF4' : '#FFFBEB') : '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: parsedRent ? (increasePct <= 7 ? '#BBF7D0' : '#FDE68A') : '#E5E7EB' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: parsedRent ? (increasePct <= 7 ? '#15803D' : '#B45309') : '#6B7280' }}>
                {parsedRent ? `${increasePct.toFixed(1)}% increase` : 'Enter the new rent to preview the increase'}
              </Text>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Effective Date</Text>
            <TextInput
              value={effectiveDate}
              onChangeText={setEffectiveDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', height: 52, paddingHorizontal: 16, fontSize: 15, color: '#111827', marginBottom: 16 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Optional note"
              placeholderTextColor="#9CA3AF"
              multiline
              style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 90, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 24, textAlignVertical: 'top' }}
            />

            <Button label="Record Rent Increase" loading={recordRentIncrease.isPending} onPress={submit} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
