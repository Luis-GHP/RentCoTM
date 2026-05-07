import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { Card } from '../../components/shared/Card';
import { ListRow } from '../../components/shared/ListRow';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { PageBackground } from '../../components/shared/PageBackground';
import { ProfileEditModal, ProfileEditState } from '../../components/account/ProfileEditModal';
import { useTenant, useUpdateTenantProfile } from '../../lib/query/tenants';
import { useTenantActiveLease } from '../../lib/query/tenant-home';
import { identityStatusLabel, identityStatusTone, useTenantIdentityVerification } from '../../lib/query/identity';
import { formatPHP, formatDate } from '../../lib/format';

const PRIMARY = '#2F4A7D';

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 12px 22px rgba(15, 23, 42, 0.12)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
});

function ProfileTexture() {
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[0, 1, 2, 3].map(index => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: 18 + index * 22,
            right: -230 + index * 30,
            width: 440,
            height: 250,
            borderRadius: 220,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${0.085 - index * 0.014})`,
            transform: [{ rotate: '-15deg' }],
          }}
        />
      ))}
      <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.035)', right: -72, bottom: -84 }} />
    </View>
  );
}

function VerificationRow({ status, onPress }: { status: string; onPress: () => void }) {
  const tone = identityStatusTone(status);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', padding: 13 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={tone.icon} size={18} color={tone.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#111827' }}>Identity Verification</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Requested by your landlord</Text>
      </View>
      <View style={{ borderRadius: 999, backgroundColor: tone.bg, paddingHorizontal: 9, paddingVertical: 5, marginRight: 8 }}>
        <Text style={{ color: tone.text, fontSize: 11, fontWeight: '900' }}>{identityStatusLabel(status)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default function TenantProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const tenantId = profile?.tenant_id ?? undefined;
  const { data: tenant, isLoading: tenantLoading } = useTenant(tenantId);
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(tenantId);
  const { data: identityVerification } = useTenantIdentityVerification(tenantId);
  const updateProfile = useUpdateTenantProfile();
  const [profileEditor, setProfileEditor] = useState<ProfileEditState | null>(null);
  const [profileError, setProfileError] = useState('');

  if (tenantLoading || leaseLoading) return <LoadingSpinner fullScreen />;

  const unitNumber = (lease?.unit as any)?.unit_number ?? '-';
  const propertyName = (lease?.unit as any)?.property?.name ?? '-';
  const tenantName = tenant?.name ?? 'Tenant';
  const displayEmail = tenant?.email ?? session?.user.email ?? 'Not set';
  const signInEmail = session?.user.email ?? 'Not set';

  function openProfileEditor() {
    if (!tenant) return;
    setProfileEditor({
      name: tenant.name ?? '',
      email: tenant.email ?? session?.user.email ?? '',
      phone: tenant.phone ?? '',
    });
    setProfileError('');
  }

  async function saveProfile() {
    if (!tenant || !profileEditor) return;
    setProfileError('');
    if (!profileEditor.name.trim()) { setProfileError('Name is required.'); return; }
    if (!profileEditor.phone.trim()) { setProfileError('Phone is required.'); return; }
    try {
      await updateProfile.mutateAsync({
        tenantId: tenant.id,
        name: profileEditor.name,
        phone: profileEditor.phone,
        email: profileEditor.email.trim() || null,
      });
      setProfileEditor(null);
    } catch {
      setProfileError('Could not update your profile.');
    }
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <PageBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: PRIMARY, paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: 48, overflow: 'hidden' }}>
          <ProfileTexture />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => router.replace('/(tenant)/more' as any)}
              activeOpacity={0.75}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Tenant Info</Text>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 3 }}>Contact and lease details</Text>
            </View>
            <TouchableOpacity
              onPress={openProfileEditor}
              activeOpacity={0.75}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="create-outline" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={tenantName} size={66} />
            <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '900' }} numberOfLines={1}>{tenantName}</Text>
              <Text style={{ color: '#D7E3F6', fontSize: 13, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>Tenant profile</Text>
            </View>
          </View>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: -24 }}>
          <Card style={{ marginBottom: 14, ...CARD_SHADOW }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 12 }}>Contact Details</Text>
            <ListRow label="Phone" value={tenant?.phone ?? 'Not set'} showDivider />
            <ListRow label="Contact Email" value={displayEmail} showDivider />
            <ListRow label="Sign-in Email" value={signInEmail} showDivider={false} />
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 12 }}>Lease Snapshot</Text>
            {lease ? (
              <>
                <ListRow label="Property" value={propertyName} showDivider />
                <ListRow label="Unit" value={`Unit ${unitNumber}`} showDivider />
                <ListRow label="Lease Start" value={formatDate(lease.start_date)} showDivider />
                <ListRow label="Lease End" value={formatDate(lease.end_date)} showDivider />
                <ListRow label="Monthly Rent" value={formatPHP(Number(lease.monthly_rent))} showDivider />
                <ListRow label="Security Deposit" value={formatPHP(Number(lease.security_deposit))} showDivider={false} />
              </>
            ) : (
              <View style={{ borderRadius: 14, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', padding: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>No active lease found</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', lineHeight: 17, marginTop: 3 }}>Contact your landlord if this account should already be connected to a unit.</Text>
              </View>
            )}
          </Card>

          {identityVerification ? (
            <Card style={{ marginBottom: 14 }}>
              <VerificationRow
                status={identityVerification.status}
                onPress={() => router.push({ pathname: '/(tenant)/identity', params: { from: 'tenant-info' } } as any)}
              />
            </Card>
          ) : null}

          <Button label="Edit Contact Details" variant="secondary" onPress={openProfileEditor} />
        </View>
      </ScrollView>

      <ProfileEditModal
        visible={!!profileEditor}
        title="Edit Profile"
        value={profileEditor ?? { name: '', email: '', phone: '' }}
        error={profileError}
        loading={updateProfile.isPending}
        onChange={setProfileEditor}
        onCancel={() => setProfileEditor(null)}
        onSave={saveProfile}
      />
    </SafeAreaView>
  );
}
