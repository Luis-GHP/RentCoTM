import { View, Text, TouchableOpacity, ScrollView, TextInput, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Button } from '../../../components/shared/Button';
import { EmptyState } from '../../../components/shared/EmptyState';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { useCreateInvite, useVacantUnitsForInvite, VacantUnitForInvite } from '../../../lib/query/tenants';
import { formatDate } from '../../../lib/format';

const PRIMARY = '#1B3C34';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'https://rentco.app';

function unitLabel(unit: VacantUnitForInvite) {
  return `Unit ${unit.unit_number}${unit.property?.name ? ` - ${unit.property.name}` : ''}`;
}

export default function InviteTenantScreen() {
  const router = useRouter();
  const { data: units, isLoading } = useVacantUnitsForInvite();
  const createInvite = useCreateInvite();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<{ link: string; expiresAt: string } | null>(null);

  const selectedUnit = (units ?? []).find(unit => unit.id === selectedUnitId);

  async function generateInvite() {
    setError('');
    if (!name.trim()) { setError('Tenant name is required.'); return; }
    if (!phone.trim()) { setError('Phone number is required.'); return; }
    if (!selectedUnitId) { setError('Select a vacant unit.'); return; }

    const run = async () => {
      try {
        const invite = await createInvite.mutateAsync({
          name: name.trim(),
          phone: phone.trim(),
          unitId: selectedUnitId,
        });
        const link = `${APP_URL.replace(/\/$/, '')}/join?token=${encodeURIComponent(invite.token)}`;
        setGenerated({ link, expiresAt: invite.expires_at });
      } catch {
        setError('Could not generate the invite link. Please try again.');
      }
    };

    if (selectedUnit?.activeInvite) {
      Alert.alert(
        'Active Invite Exists',
        'An invite for this unit is already active. Generating a new one will invalidate the old link.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Generate New Link', onPress: run },
        ]
      );
      return;
    }

    run();
  }

  async function shareInvite() {
    if (!generated) return;
    await Share.share({ message: generated.link });
  }

  async function copyInvite() {
    if (!generated) return;
    await Clipboard.setStringAsync(generated.link);
    Alert.alert('Copied', 'Invite link copied to clipboard.');
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Invite Tenant</Text>
      </View>

      {(units ?? []).length === 0 ? (
        <EmptyState icon="home-outline" title="No Vacant Units Available" subtitle="Add a vacant unit before inviting a tenant." />
      ) : generated ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 16, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5F0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="link-outline" size={24} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Invite Link Ready</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Expires {formatDate(generated.expiresAt)}</Text>
            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginTop: 14 }}>
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
              setName('');
              setPhone('');
              setSelectedUnitId('');
            }}
          />
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? <AlertBox type="error" message={error} /> : null}

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Tenant Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Juan dela Cruz"
            placeholderTextColor="#9CA3AF"
            style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, height: 52, fontSize: 15, color: '#111827', marginBottom: 16 }}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="09XX XXX XXXX"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, height: 52, fontSize: 15, color: '#111827', marginBottom: 16 }}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Unit Assignment</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', marginBottom: 16 }}>
            {units!.map((unit, index) => {
              const selected = selectedUnitId === unit.id;
              return (
                <TouchableOpacity
                  key={unit.id}
                  onPress={() => setSelectedUnitId(unit.id)}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < units!.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6', backgroundColor: selected ? `${PRIMARY}0D` : '#fff' }}
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

          <Button label="Generate Invite Link" loading={createInvite.isPending} onPress={generateInvite} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
