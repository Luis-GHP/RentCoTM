import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Button } from '../../../components/shared/Button';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import {
  ParsedUtilityBill,
  useCreateUtilityBill,
  useParseUtilityBill,
  useUtilityUnitOptions,
} from '../../../lib/query/utilities';

const PRIMARY = '#1B3C34';
const UTILITY_TYPES = ['electric', 'water', 'internet', 'other'] as const;

type PickedFile = { uri: string; name: string; size?: number };

function emptyFields(): ParsedUtilityBill {
  const now = new Date();
  return {
    provider: '',
    utility_type: 'electric',
    period_month: now.getMonth() + 1,
    period_year: now.getFullYear(),
    reading_start: null,
    reading_end: null,
    kwh_consumed: null,
    rate_per_kwh: null,
    amount: 0,
    confidence: 'low',
  };
}

export default function UploadUtilityBillScreen() {
  const router = useRouter();
  const { data: units, isLoading: unitsLoading } = useUtilityUnitOptions();
  const parseBill = useParseUtilityBill();
  const createBill = useCreateUtilityBill();
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [billPdfUrl, setBillPdfUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<ParsedUtilityBill>(emptyFields());
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [mode, setMode] = useState<'pick' | 'review'>('pick');
  const [manual, setManual] = useState(false);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPicked({ uri: asset.uri, name: asset.name, size: asset.size });
    setBanner('');
    setError('');
  }

  function enterManual() {
    setManual(true);
    setFields(emptyFields());
    setMode('review');
    setBanner('');
    setError('');
  }

  async function parseSelectedPdf() {
    if (!picked) return;
    setError('');
    setBanner('');
    const result = await parseBill.mutateAsync({ uri: picked.uri, fileName: picked.name });
    setBillPdfUrl(result.billPdfUrl);
    if (result.parsed) {
      setFields({ ...emptyFields(), ...result.parsed });
      setManual(false);
      setMode('review');
      return;
    }
    setManual(true);
    setFields(emptyFields());
    setMode('review');
    setBanner(result.message ?? 'Could not parse this document. Please enter details manually.');
  }

  function setField<K extends keyof ParsedUtilityBill>(key: K, value: ParsedUtilityBill[K]) {
    setFields(current => ({ ...current, [key]: value }));
  }

  async function saveBill() {
    setError('');
    if (!selectedUnitId) { setError('Select a unit for this bill.'); return; }
    if (!fields.provider.trim()) { setError('Provider is required.'); return; }
    if (!fields.period_month || fields.period_month < 1 || fields.period_month > 12) { setError('Period month must be 1 to 12.'); return; }
    if (!fields.period_year || fields.period_year < 2000) { setError('Enter a valid period year.'); return; }
    if (!fields.amount || fields.amount <= 0) { setError('Enter a valid amount.'); return; }

    try {
      const id = await createBill.mutateAsync({
        unitId: selectedUnitId,
        periodMonth: fields.period_month,
        periodYear: fields.period_year,
        utilityType: fields.utility_type,
        provider: fields.provider.trim(),
        readingStart: fields.reading_start,
        readingEnd: fields.reading_end,
        kwhConsumed: fields.kwh_consumed,
        ratePerKwh: fields.rate_per_kwh,
        amount: fields.amount,
        billPdfUrl,
        parsedBy: manual ? 'manual' : 'llm',
        confidence: manual ? null : fields.confidence,
      });
      Alert.alert('Utility Bill Saved', 'The bill is ready for review and confirmation.', [
        { text: 'OK', onPress: () => router.replace(`/(landlord)/utilities/${id}` as any) },
      ]);
    } catch {
      setError('Could not save this utility bill.');
    }
  }

  if (unitsLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Upload Utility Bill</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {banner ? <AlertBox type="warning" message={banner} /> : null}
        {error ? <AlertBox type="error" message={error} /> : null}

        {mode === 'pick' ? (
          <>
            <TouchableOpacity
              onPress={pickPdf}
              activeOpacity={0.75}
              style={{ minHeight: 180, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20, marginBottom: 16 }}
            >
              <Ionicons name="cloud-upload-outline" size={42} color={PRIMARY} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 12 }}>Tap to select PDF</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Utility bill PDF only</Text>
            </TouchableOpacity>

            {picked && (
              <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{picked.name}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{picked.size ? `${Math.round(picked.size / 1024)} KB` : 'Ready to parse'}</Text>
              </View>
            )}

            <Button label={parseBill.isPending ? 'Analyzing your bill...' : 'Parse with AI'} loading={parseBill.isPending} disabled={!picked} onPress={parseSelectedPdf} style={{ marginBottom: 10 }} />
            <Button label="Enter Manually Instead" variant="secondary" onPress={enterManual} />
          </>
        ) : (
          <>
            {!manual && (
              <AlertBox
                type={fields.confidence === 'high' ? 'success' : 'warning'}
                message={fields.confidence === 'high' ? 'AI parse complete. Please review before saving.' : 'Low confidence parse. Please review carefully.'}
              />
            )}

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Unit</Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', marginBottom: 16 }}>
              {(units ?? []).map((unit, index) => {
                const selected = selectedUnitId === unit.id;
                return (
                  <TouchableOpacity key={unit.id} onPress={() => setSelectedUnitId(unit.id)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < (units!.length - 1) ? 1 : 0, borderBottomColor: '#F3F4F6', backgroundColor: selected ? `${PRIMARY}0D` : '#fff' }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' }}>Unit {unit.unit_number}{unit.property?.name ? ` - ${unit.property.name}` : ''}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Utility Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {UTILITY_TYPES.map(type => (
                <TouchableOpacity key={type} onPress={() => setField('utility_type', type)} activeOpacity={0.75} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: fields.utility_type === type ? PRIMARY : '#F3F4F6' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: fields.utility_type === type ? '#fff' : '#6B7280', textTransform: 'capitalize' }}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Field label="Provider" value={fields.provider} onChange={value => setField('provider', value)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Month" value={String(fields.period_month || '')} onChange={value => setField('period_month', Number(value))} keyboardType="number-pad" style={{ flex: 1 }} />
              <Field label="Year" value={String(fields.period_year || '')} onChange={value => setField('period_year', Number(value))} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="kWh" value={fields.kwh_consumed == null ? '' : String(fields.kwh_consumed)} onChange={value => setField('kwh_consumed', value ? Number(value) : null)} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Field label="Rate" value={fields.rate_per_kwh == null ? '' : String(fields.rate_per_kwh)} onChange={value => setField('rate_per_kwh', value ? Number(value) : null)} keyboardType="decimal-pad" style={{ flex: 1 }} />
            </View>
            <Field label="Amount" value={fields.amount ? String(fields.amount) : ''} onChange={value => setField('amount', Number(value))} keyboardType="decimal-pad" />

            <Button label="Save Bill" loading={createBill.isPending} onPress={saveBill} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  style,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={label}
        placeholderTextColor="#9CA3AF"
        style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', height: 52, paddingHorizontal: 16, color: '#111827', fontSize: 15 }}
      />
    </View>
  );
}
