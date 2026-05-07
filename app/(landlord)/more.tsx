import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { Card } from '../../components/shared/Card';
import { ListRow } from '../../components/shared/ListRow';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { MainHeader } from '../../components/shared/MainHeader';
import { PageBackground } from '../../components/shared/PageBackground';
import { ProfileEditModal, ProfileEditState } from '../../components/account/ProfileEditModal';
import { useUpdateLandlordProfile } from '../../lib/query/account';
import { useLandlordInfo } from '../../lib/query/dashboard';

const ACCENT_HERO = '#FFB14A';

function AccountHeaderPanel({
  landlord,
  onEdit,
}: {
  landlord: { name?: string | null; email?: string | null; phone?: string | null } | null | undefined;
  onEdit: () => void;
}) {
  const hasPhone = !!landlord?.phone;

  return (
    <View style={{ borderRadius: 18, backgroundColor: 'rgba(30,49,88,0.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 15 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', padding: 2, marginRight: 12 }}>
          <Avatar name={landlord?.name ?? 'L'} size={48} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff' }} numberOfLines={1}>{landlord?.name ?? 'Landlord'}</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 2 }} numberOfLines={1}>Landlord account</Text>
        </View>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.78} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="create-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <View style={{ flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', padding: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase' }}>Email</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 5 }} numberOfLines={1}>{landlord?.email ?? 'Not set'}</Text>
        </View>
        <View style={{ width: 118, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', padding: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase' }}>Profile</Text>
          <Text style={{ fontSize: 13, fontWeight: '900', color: hasPhone ? '#fff' : ACCENT_HERO, marginTop: 5 }} numberOfLines={1}>{hasPhone ? 'Complete' : 'Add phone'}</Text>
        </View>
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: landlord, isLoading } = useLandlordInfo();
  const updateProfile = useUpdateLandlordProfile();
  const [profileEditor, setProfileEditor] = useState<ProfileEditState | null>(null);
  const [profileError, setProfileError] = useState('');

  function openProfileEditor() {
    if (!landlord) return;
    setProfileEditor({
      name: landlord.name ?? '',
      email: landlord.email ?? '',
      phone: landlord.phone ?? '',
    });
    setProfileError('');
  }

  async function saveProfile() {
    if (!landlord || !profileEditor) return;
    setProfileError('');
    if (!profileEditor.name.trim()) { setProfileError('Name is required.'); return; }
    if (!profileEditor.email.trim()) { setProfileError('Contact email is required.'); return; }
    try {
      await updateProfile.mutateAsync({
        landlordId: landlord.id,
        name: profileEditor.name,
        email: profileEditor.email,
        phone: profileEditor.phone || null,
      });
      setProfileEditor(null);
    } catch {
      setProfileError('Could not update your profile.');
    }
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <MainHeader title="More" subtitle="Account and workspace">
        <AccountHeaderPanel landlord={landlord} onEdit={openProfileEditor} />
      </MainHeader>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 12 }}>Contact Details</Text>
          <ListRow label="Email"  value={landlord?.email ?? '—'} showDivider />
          <ListRow label="Phone"  value={landlord?.phone ?? 'Not set'} showDivider={false} />
        </Card>

        {/* Settings */}
        <Card padded={false} style={{ marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.push('/(landlord)/documents' as any)}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="folder-open-outline" size={18} color="#2F4A7D" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>Documents</Text>
            <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(landlord)/house-rules' as any)}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="clipboard-outline" size={18} color="#2F4A7D" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>House Rules</Text>
            <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(landlord)/notifications' as any)}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="notifications-outline" size={18} color="#2F4A7D" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>Notifications</Text>
            <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(landlord)/legal' as any)}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#2F4A7D" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>Legal & Support</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>Terms, privacy, and account deletion</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
          </TouchableOpacity>

          <View
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: '#6B7280' }}>About RentCo</Text>
          </View>
        </Card>

        {/* Sign out */}
        <Button label="Sign Out" variant="danger" onPress={signOut} />
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
