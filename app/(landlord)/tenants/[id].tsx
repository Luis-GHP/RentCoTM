import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
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
import { isDocumentImage } from '../../../lib/domain/documents';
import {
  TenantIdentityVerification,
  identityStatusLabel,
  identityStatusTone,
  useRequestTenantIdentityVerification,
  useTenantIdentityVerification,
} from '../../../lib/query/identity';

const PRIMARY = '#2F4A7D';

type Tab = 'overview' | 'payments' | 'maintenance' | 'documents';

const TABS = [
  { key: 'overview' as Tab, label: 'Overview' },
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
  contract: 'Lease Contract',
  other: 'Document',
};

function govIdLabel(value: string | null | undefined) {
  return GOV_ID_TYPES.find(type => type.key === value)?.label ?? value ?? 'Not set';
}

function documentSourceLabel(doc: TenantDocumentRow) {
  if (doc.entity_type === 'tenant') return 'Tenant profile';
  if (doc.entity_type === 'lease') return 'Lease';
  if (doc.entity_type === 'rent_payment') return 'Payment';
  if (doc.entity_type === 'maintenance_request') return 'Maintenance';
  if (doc.entity_type === 'utility_bill') return 'Utility';
  return 'Record';
}

function relatedRoute(doc: TenantDocumentRow) {
  if (doc.entity_type === 'rent_payment') return `/(landlord)/payments/${doc.entity_id}`;
  if (doc.entity_type === 'maintenance_request') return `/(landlord)/maintenance/${doc.entity_id}`;
  if (doc.entity_type === 'utility_bill') return `/(landlord)/utilities/${doc.entity_id}`;
  return null;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827' }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function DocumentRow({
  doc,
  onOpen,
  onRelated,
}: {
  doc: TenantDocumentRow;
  onOpen: (doc: TenantDocumentRow) => void;
  onRelated: (doc: TenantDocumentRow) => void;
}) {
  const route = relatedRoute(doc);
  const image = isDocumentImage(doc);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
      <TouchableOpacity
        onPress={() => onOpen(doc)}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: image ? '#EDF3FF' : '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={image ? 'image-outline' : 'document-text-outline'} size={18} color={image ? PRIMARY : '#6B7280'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
            {documentSourceLabel(doc)} / {doc.uploaded_by === 'tenant' ? 'Tenant' : 'Landlord'} / {formatDate(doc.uploaded_at)}
          </Text>
        </View>
      </TouchableOpacity>
      {route ? (
        <TouchableOpacity
          onPress={() => onRelated(doc)}
          activeOpacity={0.75}
          style={{ marginLeft: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEC' }}
        >
          <Ionicons name="arrow-forward-outline" size={16} color={PRIMARY} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="open-outline" size={16} color="#9CA3AF" />
      )}
    </View>
  );
}

function IdentityVerificationPanel({
  verification,
  loading,
  requesting,
  onRequest,
}: {
  verification?: TenantIdentityVerification | null;
  loading: boolean;
  requesting: boolean;
  onRequest: () => void;
}) {
  const tone = identityStatusTone(verification?.status);
  const approved = verification?.status === 'approved';
  const canRequest = !verification || ['declined', 'expired', 'abandoned', 'kyc_expired', 'error'].includes(verification.status);
  const requestSent = verification?.status === 'not_started';

  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Identity Verification</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Didit KYC status</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: tone.bg, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Ionicons name={tone.icon} size={14} color={tone.text} />
          <Text style={{ color: tone.text, fontSize: 12, fontWeight: '900', marginLeft: 5 }}>
            {loading ? 'Checking' : identityStatusLabel(verification?.status)}
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={{ fontSize: 13, color: '#6B7280' }}>Checking the latest verification status...</Text>
      ) : verification ? (
        <>
          <View style={{ borderRadius: 14, backgroundColor: approved ? '#EAF7EF' : '#F7F6F3', borderWidth: 1, borderColor: approved ? '#BDE7CB' : '#E4E0DC', padding: 12, marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: approved ? '#14804A' : '#111827' }}>
              {approved ? 'Verified by Didit' : requestSent ? 'Request sent' : canRequest ? 'New request available' : 'Verification in progress'}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: approved ? '#14804A' : '#6B7280', marginTop: 3 }}>
              {approved
                ? 'Didit completed the ID, liveness, and face-match checks for this tenant.'
                : requestSent
                  ? 'The tenant has not started yet. They can open the request from their notification or identity page.'
                  : canRequest
                    ? verification.review_message ?? 'The previous verification is no longer active. Request a fresh verification when needed.'
                    : verification.review_message ?? 'The tenant has started verification. Refresh later after Didit finishes review.'}
            </Text>
          </View>
          <ListRow label="Started" value={verification.started_at ? formatDate(verification.started_at) : 'Not started'} showDivider />
          <ListRow label="Completed" value={verification.completed_at ? formatDate(verification.completed_at) : 'Not completed'} showDivider />
          {verification.verified_name ? <ListRow label="Verified Name" value={verification.verified_name} showDivider /> : null}
          {verification.document_type ? <ListRow label="Document" value={verification.document_type} showDivider /> : null}
          <ListRow
            label="Document Ending"
            value={verification.document_number_last4 ? `.... ${verification.document_number_last4}` : 'Not shared'}
            showDivider={false}
          />
          {canRequest ? (
            <Button
              label="Request Again"
              variant="secondary"
              loading={requesting}
              onPress={onRequest}
              style={{ marginTop: 12 }}
            />
          ) : null}
        </>
      ) : (
        <View>
          <View style={{ borderRadius: 14, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#111827' }}>Not requested</Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: '#6B7280', marginTop: 3 }}>
              Request identity verification only when you need formal ID, liveness, and face-match checks.
            </Text>
          </View>
          <Button
            label="Request Verification"
            variant="secondary"
            loading={requesting}
            onPress={onRequest}
            style={{ marginTop: 12 }}
          />
        </View>
      )}
    </View>
  );
}

export default function TenantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useTenantDetail(id);
  const { data: identityVerification, isLoading: identityLoading } = useTenantIdentityVerification(id);
  const requestIdentity = useRequestTenantIdentityVerification();
  const updateProfile = useUpdateTenantProfile();
  const uploadGovId = useUploadTenantGovernmentId();
  const setActive = useSetTenantActive();
  const [tab, setTab] = useState<Tab>('overview');
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
  const [identityNotice, setIdentityNotice] = useState('');
  const [statusTarget, setStatusTarget] = useState<boolean | null>(null);
  const [selectedImage, setSelectedImage] = useState<TenantDocumentRow | null>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
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
  const openPaymentCount = data.payments.filter(payment => payment.status !== 'paid').length;
  const openMaintenanceCount = data.maintenance.filter(request => !['resolved', 'closed'].includes(request.status)).length;

  function startProfileEdit() {
    setName(tenant.name);
    setPhone(tenant.phone);
    setEmail(tenant.email ?? '');
    setEditingProfile(true);
    setFormError('');
    setIdentityNotice('');
  }

  function startGovIdEdit() {
    setIdType(tenant.gov_id_type ?? 'philsys');
    setIdNumber(tenant.gov_id_number ?? '');
    setFrontUri(undefined);
    setBackUri(undefined);
    setEditingGovId(true);
    setFormError('');
    setIdentityNotice('');
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
    setFormError('');
    setIdentityNotice('');
    setStatusTarget(nextActive);
  }

  async function runStatusChange() {
    if (statusTarget == null) return;
    try {
      await setActive.mutateAsync({ tenantId: tenant.id, isActive: statusTarget });
      setStatusTarget(null);
    } catch {
      setFormError('Could not update tenant account status.');
    }
  }

  async function requestTenantIdentityVerification() {
    setFormError('');
    setIdentityNotice('');
    try {
      await requestIdentity.mutateAsync(tenant.id);
      setIdentityNotice('Identity verification request sent. The tenant can open it from their notifications.');
    } catch {
      setFormError('Could not request identity verification right now.');
    }
  }

  function openDocument(doc: TenantDocumentRow) {
    if (isDocumentImage(doc)) {
      setSelectedImage(doc);
      return;
    }
    Linking.openURL(doc.file_url);
  }

  function goRelated(doc: TenantDocumentRow) {
    const route = relatedRoute(doc);
    if (route) router.push(route as any);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{tenant.name}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>
            {activeLease?.unit ? `Unit ${activeLease.unit.unit_number}${activeLease.unit.property?.name ? ` - ${activeLease.unit.property.name}` : ''}` : 'No active unit'}
          </Text>
        </View>
        <TouchableOpacity onPress={startProfileEdit} activeOpacity={0.7}>
          <Ionicons name="pencil-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {!isActive ? (
          <AlertBox type="warning" message="This tenant account is inactive. They cannot access tenant screens until reactivated." />
        ) : null}
        {formError ? <AlertBox type="error" message={formError} /> : null}
        {identityNotice ? <AlertBox type="success" message={identityNotice} /> : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Avatar name={tenant.name} size={58} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 19, fontWeight: '900', color: '#111827' }} numberOfLines={1}>{tenant.name}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{tenant.email ?? tenant.phone}</Text>
            </View>
            <StatusBadge status={isActive ? 'active' : 'inactive'} />
          </View>

          {editingProfile ? (
            <View>
              <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 10, color: '#111827' }} />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 10, color: '#111827' }} />
              <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 12, color: '#111827' }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Cancel" variant="secondary" onPress={() => setEditingProfile(false)} style={{ flex: 1 }} />
                <Button label="Save" loading={updateProfile.isPending} onPress={saveProfile} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', paddingTop: 4 }}>
              <MiniStat label="Open Payments" value={openPaymentCount} />
              <View style={{ width: 1, backgroundColor: '#E4E0DC' }} />
              <MiniStat label="Open Requests" value={openMaintenanceCount} />
              <View style={{ width: 1, backgroundColor: '#E4E0DC' }} />
              <MiniStat label="Documents" value={data.documents.length} />
            </View>
          )}
        </Card>

        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F1EFEC', marginBottom: 16 }}>
          <FilterTabs tabs={TABS} active={tab} onChange={setTab} />
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            {tab === 'overview' ? (
              <>
                <View style={{ paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Contact</Text>
                  <ListRow label="Phone" value={tenant.phone} showDivider />
                  <ListRow label="Email" value={tenant.email ?? 'Not set'} showDivider={false} />
                </View>

                <IdentityVerificationPanel
                  verification={identityVerification}
                  loading={identityLoading}
                  requesting={requestIdentity.isPending}
                  onRequest={requestTenantIdentityVerification}
                />

                <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
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
                          <TouchableOpacity key={type.key} onPress={() => setIdType(type.key)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: idType === type.key ? PRIMARY : '#F1EFEC' }} activeOpacity={0.75}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: idType === type.key ? '#fff' : '#6B7280' }}>{type.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <TextInput value={idNumber} onChangeText={setIdNumber} placeholder="ID number" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 12, color: '#111827' }} />
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                        <TouchableOpacity onPress={() => pickImage('front')} style={{ flex: 1, borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, padding: 12, alignItems: 'center' }} activeOpacity={0.75}>
                          <Ionicons name="image-outline" size={20} color={frontUri ? PRIMARY : '#9CA3AF'} />
                          <Text style={{ fontSize: 12, color: frontUri ? PRIMARY : '#6B7280', marginTop: 4 }}>Front Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => pickImage('back')} style={{ flex: 1, borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, padding: 12, alignItems: 'center' }} activeOpacity={0.75}>
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
                      {(frontDoc || backDoc) ? (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                          {[frontDoc, backDoc].filter(Boolean).map(doc => (
                            <TouchableOpacity key={doc!.id} onPress={() => setSelectedImage(doc!)} activeOpacity={0.75}>
                              <Image source={{ uri: doc!.file_url }} style={{ width: 84, height: 60, borderRadius: 8, backgroundColor: '#F1EFEC' }} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <TouchableOpacity onPress={startGovIdEdit} style={{ alignItems: 'center', paddingVertical: 12 }} activeOpacity={0.75}>
                      <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: PRIMARY, marginTop: 6 }}>Add Government ID</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ paddingVertical: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Current Lease</Text>
                  {activeLease ? (
                    <>
                      <ListRow label="Unit" value={`Unit ${activeLease.unit?.unit_number ?? '-'}${activeLease.unit?.property?.name ? ` - ${activeLease.unit.property.name}` : ''}`} showDivider />
                      <ListRow label="Lease Dates" value={`${formatDate(activeLease.start_date)} - ${formatDate(activeLease.end_date)}`} showDivider />
                      <ListRow label="Monthly Rent" value={formatPHP(activeLease.monthly_rent)} showDivider />
                      <ListRow label="Security Deposit" value={formatPHP(activeLease.security_deposit)} showDivider />
                      <ListRow label="Deposit Balance" value={formatPHP(activeLease.security_deposit_balance)} showDivider />
                      <ListRow label="RA 9653" value={activeLease.is_rent_controlled ? 'Rent controlled' : 'Not rent controlled'} showDivider />
                      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 12 }}>
                        {activeLease.unit?.property?.id ? (
                          <Button
                            label="View Unit"
                            variant="secondary"
                            onPress={() => router.push(`/(landlord)/properties/${activeLease.unit!.property!.id}/units/${activeLease.unit!.id}` as any)}
                            style={{ flex: 1 }}
                          />
                        ) : null}
                        <Button
                          label="Rent Increase"
                          variant="secondary"
                          onPress={() => router.push(`/(landlord)/tenants/${tenant.id}/rent-increase` as any)}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </>
                  ) : (
                    <Text style={{ fontSize: 14, color: '#6B7280' }}>No active lease</Text>
                  )}
                </View>

                <Button
                  label={isActive ? 'Deactivate Tenant' : 'Reactivate Tenant'}
                  variant={isActive ? 'danger' : 'primary'}
                  loading={setActive.isPending}
                  onPress={() => confirmStatusChange(!isActive)}
                />
              </>
            ) : null}

            {tab === 'payments' ? (
              data.payments.length === 0 ? (
                <EmptyState icon="receipt-outline" title="No Payments Yet" subtitle="Payment history will appear here." />
              ) : data.payments.map(payment => (
                <TouchableOpacity key={payment.id} onPress={() => router.push(`/(landlord)/payments/${payment.id}`)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{getMonthName(payment.period_month)} {payment.period_year}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatPHP(payment.amount_paid)} paid of {formatPHP(payment.amount_due)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{payment.or_number ?? 'No OR'}</Text>
                    <StatusBadge status={payment.status} />
                  </View>
                </TouchableOpacity>
              ))
            ) : null}

            {tab === 'maintenance' ? (
              data.maintenance.length === 0 ? (
                <EmptyState icon="construct-outline" title="No Requests Yet" subtitle="Maintenance requests will appear here." />
              ) : data.maintenance.map(request => (
                <TouchableOpacity key={request.id} onPress={() => router.push(`/(landlord)/maintenance/${request.id}`)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{request.title}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{request.category} / {request.priority} / {formatDate(request.created_at)}</Text>
                  </View>
                  <StatusBadge status={request.status} />
                </TouchableOpacity>
              ))
            ) : null}

            {tab === 'documents' ? (
              data.documents.length === 0 ? (
                <EmptyState icon="document-text-outline" title="No Documents Yet" subtitle="Tenant-related receipts, bills, IDs, and photos will appear here." />
              ) : data.documents.map(doc => (
                <DocumentRow key={doc.id} doc={doc} onOpen={openDocument} onRelated={goRelated} />
              ))
            ) : null}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.92)', padding: 16, justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.8}
            style={{ position: 'absolute', top: 54, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {selectedImage ? (
            <>
              <Image source={{ uri: selectedImage.file_url }} resizeMode="contain" style={{ width: '100%', height: '78%' }} />
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 12 }} numberOfLines={1}>
                {selectedImage.file_name ?? DOC_LABELS[selectedImage.doc_type] ?? 'Document'}
              </Text>
              <TouchableOpacity
                onPress={() => selectedImage && Linking.openURL(selectedImage.file_url)}
                activeOpacity={0.8}
                style={{ alignSelf: 'center', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginTop: 16 }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Open Original</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Modal>

      <AppModal
        visible={statusTarget != null}
        tone={statusTarget ? 'info' : 'danger'}
        title={statusTarget ? 'Reactivate Tenant?' : 'Deactivate Tenant?'}
        message={statusTarget
          ? 'This tenant will be able to access their tenant account again.'
          : 'This tenant will be blocked from tenant routes, but their rental history will stay preserved.'}
        cancelLabel="Cancel"
        confirmLabel={statusTarget ? 'Reactivate' : 'Deactivate'}
        confirmVariant={statusTarget ? 'primary' : 'danger'}
        loading={setActive.isPending}
        onCancel={() => !setActive.isPending && setStatusTarget(null)}
        onConfirm={runStatusChange}
      />
    </SafeAreaView>
  );
}
