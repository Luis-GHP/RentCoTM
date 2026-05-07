import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Button } from '../../../components/shared/Button';
import {
  ElectricProvider,
  PropertyType,
  useCreateProperty,
} from '../../../lib/query/properties';

const PRIMARY = '#2F4A7D';

const PROPERTY_TYPES: { key: PropertyType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'apartment', label: 'Apartment', icon: 'business-outline' },
  { key: 'house', label: 'House', icon: 'home-outline' },
  { key: 'condo', label: 'Condo', icon: 'layers-outline' },
  { key: 'boarding_house', label: 'Boarding House', icon: 'people-outline' },
  { key: 'commercial', label: 'Commercial', icon: 'storefront-outline' },
];

const PROVIDERS: { key: ElectricProvider; label: string; hint: string }[] = [
  { key: 'meralco', label: 'Meralco', hint: 'Approx. PHP 11/kWh' },
  { key: 'veco', label: 'VECO', hint: 'Approx. PHP 10/kWh' },
  { key: 'dlpc', label: 'DLPC', hint: 'Approx. PHP 10/kWh' },
  { key: 'beneco', label: 'BENECO', hint: 'Approx. PHP 9/kWh' },
  { key: 'neeco', label: 'NEECO', hint: 'Approx. PHP 11/kWh' },
  { key: 'manual', label: 'Manual', hint: '' },
];

export default function AddPropertyScreen() {
  const router = useRouter();
  const createProperty = useCreateProperty();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [electricProvider, setElectricProvider] = useState<ElectricProvider>('manual');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');

  const selectedProvider = PROVIDERS.find(provider => provider.key === electricProvider)!;
  const requiresRate = electricProvider !== 'manual';

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
      const id = await createProperty.mutateAsync({
        name,
        address,
        type: propertyType,
        electricProvider,
        defaultRatePerKwh: requiresRate ? parsedRate : null,
      });
      router.replace(`/(landlord)/properties/${id}` as any);
    } catch {
      setError('Could not add this property right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Add Property</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? <AlertBox type="error" message={error} /> : null}

        <Field label="Property Name" value={name} onChange={setName} placeholder="Name shown in RentCo" />
        <Field label="Address" value={address} onChange={setAddress} placeholder="Street, city, province" multiline />

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Property Type</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', overflow: 'hidden', marginBottom: 16 }}>
          {PROPERTY_TYPES.map((type, index) => {
            const selected = propertyType === type.key;
            return (
              <TouchableOpacity
                key={type.key}
                onPress={() => setPropertyType(type.key)}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  backgroundColor: selected ? `${PRIMARY}0D` : '#fff',
                  borderBottomWidth: index < PROPERTY_TYPES.length - 1 ? 1 : 0,
                  borderBottomColor: '#F1EFEC',
                }}
              >
                <Ionicons name={type.icon} size={20} color={selected ? PRIMARY : '#9CA3AF'} style={{ marginRight: 12 }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: selected ? PRIMARY : '#111827' }}>{type.label}</Text>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={PRIMARY} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Electric Provider</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {PROVIDERS.map(provider => {
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

        <Button label="Add Property" loading={createProperty.isPending} onPress={save} />
      </ScrollView>
    </SafeAreaView>
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
