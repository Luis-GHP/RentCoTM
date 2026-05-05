import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { Card } from '../../components/shared/Card';
import { ListRow } from '../../components/shared/ListRow';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useLandlordInfo } from '../../lib/query/dashboard';

export default function MoreScreen() {
  const { signOut } = useAuth();
  const { data: landlord, isLoading } = useLandlordInfo();

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>More</Text>

        {/* Profile card */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Avatar name={landlord?.name ?? 'L'} size={56} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{landlord?.name ?? '—'}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Landlord</Text>
            </View>
          </View>
          <ListRow label="Email"  value={landlord?.email ?? '—'} showDivider />
          <ListRow label="Phone"  value={landlord?.phone ?? 'Not set'} showDivider={false} />
        </Card>

        {/* Settings */}
        <Card padded={false} style={{ marginBottom: 16 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="notifications-outline" size={18} color="#9CA3AF" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: '#6B7280' }}>Notifications</Text>
          </View>

          <View
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: '#6B7280' }}>About RentCo</Text>
          </View>
        </Card>

        {/* Sign out */}
        <Button label="Sign Out" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
