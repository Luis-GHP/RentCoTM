import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Avatar } from '../../../components/shared/Avatar';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { EmptyState } from '../../../components/shared/EmptyState';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import {
  TenantDocumentRow,
  useSetTenantActive,
  useTenantDetail,
  useUpdateTenantProfile,
  useUploadTenantGovernmentId,
} from '../../../lib/query/tenants';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

type Tab = 'payments' | 'maintenance' | 'documents';

const TABS = [
  { key: 'payments' as Tab, label: 'Payments' },
  { key: 'maintenance' as Tab, label: 'Maintenance' },
  { key: 'documents' as Tab, label: 'Documents' },
];

const GOV_ID_TYPES = [
  { key: 'philsys', label: 'PhilSys' },
  { key: 'sss', label: 'SSS' },
  { key: 'philhealth', label: 'PhilHealth' },
  { key: 'passport', label: 'Passport' },
  { key: 'drivers_license', label: "Driver's License" },
  { key: 'voters', label: "Voter's ID" },
];

const DOC_LABELS: Record<string, string> = {
  gov_id: 'Government ID',
  gov_id_front: 'Government ID Front',
  gov_id_back: 'Government ID Back',
  receipt: 'Receipt',
  or_pdf: 'Official Receipt',
  utility_bill_pdf: 'Utility Bill',
  bill: 'Bill',
  photo: 'Photo',
};

function govIdLabel(value: string | null | undefined) {
  return GOV_ID_TYPES.find(type => type.key === value)?.label ?? value ?? 'Not set';
}

function DocumentRow({ doc }: { doc: TenantDocumentRow }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(doc.file_url)}
      activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={doc.file_url.match(/\.(jpg|jpeg|png|webp)$/i) ? 'image-outline' : 'document-text-outline'} size={18} color="#6B7280" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{doc.file_name ?? 'Uploaded file'} - {formatDate(doc.uploaded_at)}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default function TenantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useTenantDetail(id);
  const updateProfile = useUpdateTenantProfile();
  const uploadGovId = useUploadTenantGovernmentId();
  const setActive = useSetTenantActive();
  const [tab, setTab] = useState<Tab>('payments');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingGovId, setEditingGovId] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idType, setIdType] = useState('philsys');
  const [idNumber, setIdNumber] = useState('');
  const [frontUri, setFrontUri] = useState<string | undefined>();
  const [backUri, setBackUri] = useState<string | undefined>();
  const [formError, setFormError] = useState('');

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load tenant right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tenant = data.tenant;
  const activeLease = data.activeLease;
  const isActive = data.row?.is_active ?? false;
  const frontDoc = data.documents.find(doc => doc.doc_type === 'gov_id_front' || doc.doc_type === 'gov_id');
  const backDoc = data.documents.find(doc => doc.doc_type === 'gov_id_back');

  function startProfileEdit() {
    setName(tenant.name);
    setPhone(tenant.phone);
    setEmail(tenant.email ?? '');
    setEditingProfile(true);
    setFormError('');
  }

  function startGovIdEdit() {
    setIdType(tenant.gov_id_type ?? 'philsys');
    setIdNumber(tenant.gov_id_number ?? '');
    setFrontUri(undefined);
    setBackUri(undefined);
    setEditingGovId(true);
    setFormError('');
  }

  async function saveProfile() {
    setFormError('');
    if (!name.trim() || !phone.trim()) {
      setFormError('Name and phone are required.');
      return;
    }
    try {
      await updateProfile.mutateAsync({ tenantId: tenant.id, name, phone, email });
      setEditingProfile(false);
    } catch {
      setFormError('Could not update the tenant profile.');
    }
  }

  async function pickImage(side: 'front' | 'back') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    if (side === 'front') setFrontUri(result.assets[0].uri);
    if (side === 'back') setBackUri(result.assets[0].uri);
  }

  async function saveGovId() {
    setFormError('');
    if (!idNumber.trim()) {
      setFormError('Government ID number is required.');
      return;
    }
    try {
      await uploadGovId.mutateAsync({ tenantId: tenant.id, idType, idNumber, frontUri, backUri });
      setEditingGovId(false);
    } catch {
      setFormError('Could not save the government ID.');
    }
  }

  function confirmStatusChange(nextActive: boolean) {
    Alert.alert(
      nextActive ? 'Reactivate Tenant' : 'Deactivate Tenant',
      nextActive
        ? 'This tenant will be able to access their tenant account again.'
        : 'This tenant will be blocked from tenant routes, but their rental history will stay preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextActive ? 'Reactivate' : 'Deactivate',
          style: nextActive ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await setActive.mutateAsync({ tenantId: tenant.id, isActive: nextActive });
            } catch {
              Alert.alert('Error', 'Could not update tenant account status.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{tenant.name}</Text>
        <TouchableOpacity onPress={startProfileEdit} activeOpacity={0.7}>
          <Ionicons name="pencil-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {!isActive && (
          <AlertBox type="warning" message="This tenant account is inactive. They cannot access tenant screens until reactivated." />
        )}
        {formError ? <AlertBox type="error" message={formError} /> : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Avatar name={tenant.name} size={56} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{tenant.name}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Tenant</Text>
            </View>
            <StatusBadge status={isActive ? 'active' : 'inactive'} />
          </View>

          {editingProfile ? (
            <View>
              <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 10, color: '#111827' }} />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 10, color: '#111827' }} />
              <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 12, color: '#111827' }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Cancel" variant="secondary" onPress={() => setEditingProfile(false)} style={{ flex: 1 }} />
                <Button label="Save" loading={updateProfile.isPending} onPress={saveProfile} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <>
              <ListRow label="Phone" value={tenant.phone} showDivider />
              <ListRow label="Email" value={tenant.email ?? 'Not set'} showDivider={false} />
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' }}>Government ID</Text>
            <TouchableOpacity onPress={startGovIdEdit} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: PRIMARY }}>{tenant.gov_id_number ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          </View>

          {editingGovId ? (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                {GOV_ID_TYPES.map(type => (
                  <TouchableOpacity key={type.key} onPress={() => setIdType(type.key)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: idType === type.key ? PRIMARY : '#F3F4F6' }} activeOpacity={0.75}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: idType === type.key ? '#fff' : '#6B7280' }}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput value={idNumber} onChangeText={setIdNumber} placeholder="ID number" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 12, color: '#111827' }} />
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => pickImage('front')} style={{ flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, alignItems: 'center' }} activeOpacity={0.75}>
                  <Ionicons name="image-outline" size={20} color={frontUri ? PRIMARY : '#9CA3AF'} />
                  <Text style={{ fontSize: 12, color: frontUri ? PRIMARY : '#6B7280', marginTop: 4 }}>Front Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pickImage('back')} style={{ flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, alignItems: 'center' }} activeOpacity={0.75}>
                  <Ionicons name="image-outline" size={20} color={backUri ? PRIMARY : '#9CA3AF'} />
                  <Text style={{ fontSize: 12, color: backUri ? PRIMARY : '#6B7280', marginTop: 4 }}>Back Photo</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Cancel" variant="secondary" onPress={() => setEditingGovId(false)} style={{ flex: 1 }} />
                <Button label="Save ID" loading={uploadGovId.isPending} onPress={saveGovId} style={{ flex: 1 }} />
              </View>
            </View>
          ) : tenant.gov_id_number ? (
            <>
              <ListRow label="ID Type" value={govIdLabel(tenant.gov_id_type)} showDivider />
              <ListRow label="ID Number" value={tenant.gov_id_number} showDivider={false} />
              {(frontDoc || backDoc) && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  {[frontDoc, backDoc].filter(Boolean).map(doc => (
                    <TouchableOpacity key={doc!.id} onPress={() => Linking.openURL(doc!.file_url)} activeOpacity={0.75}>
                      <Image source={{ uri: doc!.file_url }} style={{ width: 84, height: 60, borderRadius: 8, backgroundColor: '#F3F4F6' }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity onPress={startGovIdEdit} style={{ alignItems: 'center', paddingVertical: 12 }} activeOpacity={0.75}>
              <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: PRIMARY, marginTop: 6 }}>Add Government ID</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Current Lease</Text>
          {activeLease ? (
            <>
              <ListRow label="Unit" value={`Unit ${activeLease.unit?.unit_number ?? '-'}${activeLease.unit?.property?.name ? ` - ${activeLease.unit.property.name}` : ''}`} showDivider />
              <ListRow label="Lease Dates" value={`${formatDate(activeLease.start_date)} - ${formatDate(activeLease.end_date)}`} showDivider />
              <ListRow label="Monthly Rent" value={formatPHP(activeLease.monthly_rent)} showDivider />
              <ListRow label="Security Deposit" value={formatPHP(activeLease.security_deposit)} showDivider />
              <ListRow label="Deposit Balance" value={formatPHP(activeLease.security_deposit_balance)} showDivider />
              <ListRow label="RA 9653" value={activeLease.is_rent_controlled ? 'Rent controlled' : 'Not rent controlled'} showDivider />
              <TouchableOpacity onPress={() => router.push(`/(landlord)/tenants/${tenant.id}/rent-increase` as any)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: PRIMARY }}>Rent Increase</Text>
                <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: '#6B7280' }}>No active lease</Text>
          )}
        </Card>

        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 16 }}>
          <FilterTabs tabs={TABS} active={tab} onChange={setTab} />
          <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
            {tab === 'payments' && (
              data.payments.length === 0 ? (
                <EmptyState icon="receipt-outline" title="No Payments Yet" subtitle="Payment history will appear here." />
              ) : data.payments.map(payment => (
                <TouchableOpacity key={payment.id} onPress={() => router.push(`/(landlord)/payments/${payment.id}`)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{getMonthName(payment.period_month)} {payment.period_year}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{payment.or_number ?? 'No OR yet'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{formatPHP(payment.amount_due)}</Text>
                    <StatusBadge status={payment.status} />
                  </View>
                </TouchableOpacity>
              ))
            )}

            {tab === 'maintenance' && (
              data.maintenance.length === 0 ? (
                <EmptyState icon="construct-outline" title="No Requests Yet" subtitle="Maintenance requests will appear here." />
              ) : data.maintenance.map(request => (
                <TouchableOpacity key={request.id} onPress={() => router.push(`/(landlord)/maintenance/${request.id}`)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{request.title}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{request.category} - {formatDate(request.created_at)}</Text>
                  </View>
                  <StatusBadge status={request.status} />
                </TouchableOpacity>
              ))
            )}

            {tab === 'documents' && (
              data.documents.length === 0 ? (
                <EmptyState icon="document-text-outline" title="No Documents Yet" subtitle="Tenant documents will appear here." />
              ) : data.documents.map(doc => <DocumentRow key={doc.id} doc={doc} />)
            )}
          </View>
        </View>

        <Button
          label={isActive ? 'Deactivate Tenant' : 'Reactivate Tenant'}
          variant={isActive ? 'danger' : 'primary'}
          loading={setActive.isPending}
          onPress={() => confirmStatusChange(!isActive)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
