import { View, Text, TouchableOpacity, ScrollView, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
import { Button } from '../../../components/shared/Button';
import { EmptyState } from '../../../components/shared/EmptyState';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { useCreateInvite, useVacantUnitsForInvite, VacantUnitForInvite } from '../../../lib/query/tenants';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#2F4A7D';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL?.trim();

function unitLabel(unit: VacantUnitForInvite) {
  return `Unit ${unit.unit_number}${unit.property?.name ? ` - ${unit.property.name}` : ''}`;
}

function toDateInput(date: Date) {
  return date.toISOString().split('T')[0];
}

function oneYearFrom(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setFullYear(date.getFullYear() + 1);
  return toDateInput(date);
}

function inviteLink(token: string) {
  if (APP_URL) {
    return `${APP_URL.replace(/\/$/, '')}/join?token=${encodeURIComponent(token)}`;
  }
  return Linking.createURL('/join', { queryParams: { token } });
}

export default function InviteTenantScreen() {
  const router = useRouter();
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { data: units, isLoading, error: unitsError } = useVacantUnitsForInvite();
  const createInvite = useCreateInvite();
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [startDate, setStartDate] = useState(toDateInput(new Date()));
  const [endDate, setEndDate] = useState(oneYearFrom(toDateInput(new Date())));
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [advanceMonths, setAdvanceMonths] = useState('1');
  const [error, setError] = useState('');
  const [copyBanner, setCopyBanner] = useState('');
  const [replaceInviteOpen, setReplaceInviteOpen] = useState(false);
  const [generated, setGenerated] = useState<{ link: string; expiresAt: string } | null>(null);

  const selectedUnit = (units ?? []).find(unit => unit.id === selectedUnitId);
  const requestedUnitMissing = !!unitId && !!units && !units.some(unit => unit.id === unitId);

  useEffect(() => {
    if (!unitId || selectedUnitId || !units?.some(unit => unit.id === unitId)) return;
    setSelectedUnitId(unitId);
  }, [selectedUnitId, unitId, units]);

  useEffect(() => {
    if (!selectedUnit) return;
    const rent = String(Number(selectedUnit.monthly_rent));
    setMonthlyRent(rent);
    setSecurityDeposit(rent);
  }, [selectedUnit]);

  function errorMessage(err: unknown) {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return '';
  }

  function inviteErrorMessage(err: unknown) {
    const message = errorMessage(err);
    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes('schema cache') ||
      lowerMessage.includes('could not find the function') ||
      lowerMessage.includes('pgrst202')
    ) {
      return 'Supabase still has the old invite function cached. Run SQL 25, then reload Expo.';
    }
    if (lowerMessage.includes('tenant_invite.unit_id')) return 'Tenant invites are missing the latest database fields. Run migrations 004, 008, and 25 in Supabase, then reload Expo.';
    if (lowerMessage.includes('unit is not available')) return 'That unit is not available for invite anymore. Pick a vacant unit and try again.';
    if (lowerMessage.includes('permission denied')) return 'Your account needs the landlord role before it can create tenant invites.';
    if (message) return `Could not generate invite: ${message}`;
    return 'Could not generate the invite link. Please try again.';
  }

  async function runInviteMutation() {
    setReplaceInviteOpen(false);
    try {
      const invite = await createInvite.mutateAsync({
        unitId: selectedUnitId,
        startDate,
        endDate,
        monthlyRent: Number(monthlyRent),
        securityDeposit: Number(securityDeposit),
        advanceMonths: Number(advanceMonths),
      });
      const link = inviteLink(invite.token);
      setGenerated({ link, expiresAt: invite.expires_at });
    } catch (err) {
      console.warn('Could not create tenant invite', err);
      setError(inviteErrorMessage(err));
    }
  }

  async function generateInvite() {
    setError('');
    setCopyBanner('');
    if (!selectedUnitId) { setError('Select a vacant unit.'); return; }
    const rent = Number(monthlyRent);
    const deposit = Number(securityDeposit);
    const advance = Number(advanceMonths);
    if (!startDate || !endDate) { setError('Lease start and end dates are required.'); return; }
    if (new Date(`${endDate}T00:00:00`) <= new Date(`${startDate}T00:00:00`)) { setError('Lease end date must be after the start date.'); return; }
    if (!Number.isFinite(rent) || rent <= 0) { setError('Monthly rent must be greater than zero.'); return; }
    if (!Number.isFinite(deposit) || deposit < 0) { setError('Security deposit cannot be negative.'); return; }
    if (!Number.isInteger(advance) || advance < 0 || advance > 12) { setError('Advance months must be between 0 and 12.'); return; }

    if (selectedUnit?.activeInvite) {
      setReplaceInviteOpen(true);
      return;
    }

    await runInviteMutation();
  }

  async function shareInvite() {
    if (!generated) return;
    await Share.share({ message: generated.link });
  }

  async function copyInvite() {
    if (!generated) return;
    await Clipboard.setStringAsync(generated.link);
    setCopyBanner('Invite link copied.');
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Invite Tenant</Text>
      </View>

      {unitsError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't Load Vacant Units"
          subtitle="Reload the app after the latest Supabase migrations are applied."
        />
      ) : (units ?? []).length === 0 ? (
        <EmptyState icon="home-outline" title="No Vacant Units Available" subtitle="Add a vacant unit before inviting a tenant." />
      ) : generated ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {copyBanner ? <AlertBox type="success" message={copyBanner} /> : null}

          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', padding: 16, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="link-outline" size={24} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Invite Link Ready</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Expires {formatDate(generated.expiresAt)}</Text>
            <View style={{ backgroundColor: '#F7F6F3', borderRadius: 10, borderWidth: 1, borderColor: '#E4E0DC', padding: 12, marginTop: 14 }}>
              <Text style={{ fontSize: 13, color: '#374151' }} selectable>{generated.link}</Text>
            </View>
          </View>

          <Button label="Share Invite Link" onPress={shareInvite} style={{ marginBottom: 10 }} />
          <Button label="Copy Link" variant="secondary" onPress={copyInvite} style={{ marginBottom: 10 }} />
          <Button
            label="Generate New Link"
            variant="secondary"
            onPress={() => {
              setGenerated(null);
              setSelectedUnitId('');
              setStartDate(toDateInput(new Date()));
              setEndDate(oneYearFrom(toDateInput(new Date())));
              setMonthlyRent('');
              setSecurityDeposit('');
              setAdvanceMonths('1');
              setCopyBanner('');
            }}
          />
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? <AlertBox type="error" message={error} /> : null}
          {requestedUnitMissing ? (
            <AlertBox type="warning" message="That unit is no longer available for invite. Choose another vacant unit below." />
          ) : null}

          <View style={{ backgroundColor: '#EDF3FF', borderRadius: 14, borderWidth: 1, borderColor: '#D8E2F2', padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: PRIMARY }}>Tenant fills in their profile</Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: '#3F5F95', marginTop: 4 }}>
              This invite only assigns the unit and lease terms. The tenant will enter their name, phone, and email when they create their account.
            </Text>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Unit Assignment</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', overflow: 'hidden', marginBottom: 16 }}>
            {units!.map((unit, index) => {
              const selected = selectedUnitId === unit.id;
              return (
                <TouchableOpacity
                  key={unit.id}
                  onPress={() => setSelectedUnitId(unit.id)}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < units!.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC', backgroundColor: selected ? `${PRIMARY}0D` : '#fff' }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{unitLabel(unit)}</Text>
                    {unit.activeInvite ? (
                      <Text style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>Active invite expires {formatDate(unit.activeInvite.expires_at)}</Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{unit.type ? unit.type.replace('_', ' ') : 'Unit'}</Text>
                    )}
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Lease Terms</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', padding: 14, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Start Date" value={startDate} onChange={value => { setStartDate(value); if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setEndDate(oneYearFrom(value)); }} placeholder="YYYY-MM-DD" />
              <Field label="End Date" value={endDate} onChange={setEndDate} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} placeholder="0.00" keyboardType="decimal-pad" />
              <Field label="Security Deposit" value={securityDeposit} onChange={setSecurityDeposit} placeholder="0.00" keyboardType="decimal-pad" />
            </View>
            <Field label="Advance Months" value={advanceMonths} onChange={setAdvanceMonths} placeholder="1" keyboardType="number-pad" />
          </View>

          <Button label="Generate Invite Link" loading={createInvite.isPending} onPress={generateInvite} />
        </ScrollView>
      )}
      <AppModal
        visible={replaceInviteOpen}
        tone="warning"
        title="Active Invite Exists"
        message="An invite for this unit is already active. Generating a new one will invalidate the old link."
        cancelLabel="Cancel"
        confirmLabel="Generate New Link"
        loading={createInvite.isPending}
        onCancel={() => !createInvite.isPending && setReplaceInviteOpen(false)}
        onConfirm={runInviteMutation}
      />
    </SafeAreaView>
  );
}

function Field({
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
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        style={{ backgroundColor: '#F7F6F3', borderRadius: 10, borderWidth: 1, borderColor: '#E4E0DC', paddingHorizontal: 12, height: 46, fontSize: 14, color: '#111827' }}
      />
    </View>
  );
}
