import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
import { Button } from '../../../components/shared/Button';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import {
  ParsedUtilityBill,
  useCreateUtilityBill,
  useParseUtilityBill,
  useUtilityUnitOptions,
} from '../../../lib/query/utilities';

const PRIMARY = '#2F4A7D';
const UTILITY_TYPES = ['electric', 'water', 'internet', 'other'] as const;
const ELECTRIC_PROVIDER_LABELS: Record<string, string> = {
  meralco: 'Meralco',
  veco: 'VECO',
  dlpc: 'DLPC',
  beneco: 'BENECO',
  neeco: 'NEECO',
};

type PickedFile = { uri: string; name: string; size?: number };
type ReviewSource = 'ai' | 'manual' | 'fallback';

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
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { data: units, isLoading: unitsLoading } = useUtilityUnitOptions();
  const parseBill = useParseUtilityBill();
  const createBill = useCreateUtilityBill();
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [billPdfUrl, setBillPdfUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<ParsedUtilityBill>(emptyFields());
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [mode, setMode] = useState<'pick' | 'review'>('pick');
  const [reviewSource, setReviewSource] = useState<ReviewSource>('manual');
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [savedBillId, setSavedBillId] = useState<string | null>(null);
  const selectedUnit = (units ?? []).find(unit => unit.id === selectedUnitId) ?? null;
  const manual = reviewSource !== 'ai';

  useEffect(() => {
    if (selectedUnitId || !units) return;
    const requestedUnit = unitId ? units.find(unit => unit.id === unitId) : null;
    if (requestedUnit) {
      setSelectedUnitId(requestedUnit.id);
      return;
    }
    if (units.length === 1) setSelectedUnitId(units[0].id);
  }, [selectedUnitId, unitId, units]);

  useEffect(() => {
    if (!selectedUnit || fields.utility_type !== 'electric') return;

    const provider = selectedUnit.property?.electric_provider;
    const rate = selectedUnit.property?.default_rate_per_kwh;
    if (!provider && rate == null) return;

    setFields(current => {
      if (current.utility_type !== 'electric') return current;

      let changed = false;
      const next = { ...current };
      if (!current.provider.trim() && provider && provider !== 'manual') {
        next.provider = ELECTRIC_PROVIDER_LABELS[provider] ?? provider;
        changed = true;
      }
      if (current.rate_per_kwh == null && rate != null) {
        next.rate_per_kwh = Number(rate);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [
    fields.utility_type,
    selectedUnit,
  ]);

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPicked({ uri: asset.uri, name: asset.name, size: asset.size });
    setBillPdfUrl(null);
    setBanner('');
    setError('');
  }

  function removePickedPdf() {
    if (parseBill.isPending || createBill.isPending) return;
    setPicked(null);
    setBillPdfUrl(null);
    setBanner('');
    setError('');
  }

  function enterManual() {
    setReviewSource('manual');
    setFields(emptyFields());
    setMode('review');
    setBanner('');
    setError('');
  }

  async function parseSelectedPdf() {
    if (!picked) return;
    setError('');
    setBanner('');
    try {
      const result = await parseBill.mutateAsync({ uri: picked.uri, fileName: picked.name });
      setBillPdfUrl(result.billPdfUrl);
      if (result.parsed) {
        setFields({ ...emptyFields(), ...result.parsed });
        setReviewSource('ai');
        setMode('review');
        return;
      }
      setReviewSource('fallback');
      setFields(emptyFields());
      setMode('review');
      setBanner('We could not read this PDF automatically. Add the bill details below, then save it when everything looks right.');
    } catch (err) {
      const message = err instanceof Error && err.message.toLowerCase().includes('row-level security')
        ? 'Storage is not ready for utility bill uploads. Apply the latest Supabase storage migration, then try again.'
        : 'Could not upload this PDF. Try again, or enter the bill manually.';
      setError(message);
    }
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
        billFileName: picked?.name ?? null,
        parsedBy: manual ? 'manual' : 'llm',
        confidence: manual ? null : fields.confidence,
      });
      setSavedBillId(id);
    } catch {
      setError('Could not save this utility bill.');
    }
  }

  function goBack() {
    if (createBill.isPending || parseBill.isPending) return;
    if (mode === 'review') {
      setMode('pick');
      setError('');
      setBanner('');
      return;
    }
    router.back();
  }

  function viewSavedBill() {
    if (!savedBillId) return;
    router.replace(`/(landlord)/utilities/${savedBillId}` as any);
  }

  if (unitsLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Upload Utility Bill</Text>
          {mode === 'review' ? (
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Review and edit before saving</Text>
          ) : null}
        </View>
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
              <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{picked.name}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{picked.size ? `${Math.round(picked.size / 1024)} KB` : 'Ready to parse'}</Text>
                </View>
                <TouchableOpacity
                  onPress={removePickedPdf}
                  activeOpacity={0.75}
                  disabled={parseBill.isPending || createBill.isPending}
                  style={{ marginLeft: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', opacity: parseBill.isPending || createBill.isPending ? 0.55 : 1 }}
                >
                  <Ionicons name="trash-outline" size={17} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}

            <Button label={parseBill.isPending ? 'Analyzing your bill...' : 'Parse with AI'} loading={parseBill.isPending} disabled={!picked} onPress={parseSelectedPdf} style={{ marginBottom: 10 }} />
            <Button label="Enter Manually Instead" variant="secondary" onPress={enterManual} />
          </>
        ) : (
          <>
            <ReviewBanner source={reviewSource} />

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Unit</Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', overflow: 'hidden', marginBottom: 16 }}>
              {(units ?? []).map((unit, index) => {
                const selected = selectedUnitId === unit.id;
                return (
                  <TouchableOpacity key={unit.id} onPress={() => setSelectedUnitId(unit.id)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < (units!.length - 1) ? 1 : 0, borderBottomColor: '#F1EFEC', backgroundColor: selected ? `${PRIMARY}0D` : '#fff' }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' }}>Unit {unit.unit_number}{unit.property?.name ? ` - ${unit.property.name}` : ''}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Utility Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {UTILITY_TYPES.map(type => (
                <TouchableOpacity key={type} onPress={() => setField('utility_type', type)} activeOpacity={0.75} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: fields.utility_type === type ? PRIMARY : '#F1EFEC' }}>
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

            <Button label="Save Bill" loading={createBill.isPending} onPress={saveBill} style={{ marginBottom: 10 }} />
            <Button label={picked ? 'Change PDF' : 'Back to Upload'} variant="secondary" onPress={goBack} disabled={createBill.isPending} />
          </>
        )}
      </ScrollView>

      <AppModal
        visible={!!savedBillId}
        tone="success"
        title="Bill Saved"
        message="The utility bill is now posted and ready to view."
        confirmLabel="View Bill"
        onConfirm={viewSavedBill}
      />
    </SafeAreaView>
  );
}

function ReviewBanner({ source }: { source: ReviewSource }) {
  const subtitle = source === 'ai'
    ? 'AI filled in the bill details. Make any edits needed, then save.'
    : source === 'fallback'
      ? 'The PDF is attached. Enter the bill details below, then save.'
      : 'Enter the bill details below, then save.';

  return (
    <View
      style={{
        backgroundColor: PRIMARY,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(255,255,255,0.14)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Review carefully before saving.</Text>
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, marginTop: 3 }}>
          {subtitle}
        </Text>
      </View>
    </View>
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
        style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E4E0DC', height: 52, paddingHorizontal: 16, color: '#111827', fontSize: 15 }}
      />
    </View>
  );
}
