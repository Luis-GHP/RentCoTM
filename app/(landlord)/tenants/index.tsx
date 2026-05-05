import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const PRIMARY = '#1B3C34';

export default function TenantsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Tenants</Text>
        <TouchableOpacity onPress={() => router.push('/(landlord)/tenants/invite')} activeOpacity={0.7}>
          <Ionicons name="person-add-outline" size={24} color={PRIMARY} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Ionicons name="people-outline" size={48} color="#D1D5DB" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#9CA3AF' }}>Tenants — coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
