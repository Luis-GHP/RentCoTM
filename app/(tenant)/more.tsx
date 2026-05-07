import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { PageBackground } from '../../components/shared/PageBackground';
import { useTenant } from '../../lib/query/tenants';
import { useTenantActiveLease } from '../../lib/query/tenant-home';

const PRIMARY = '#2F4A7D';

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

function AccountRow({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#F1EFEC',
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default function TenantMore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const tenantId = profile?.tenant_id ?? undefined;
  const { data: tenant, isLoading: tenantLoading } = useTenant(tenantId);
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(tenantId);

  if (tenantLoading || leaseLoading) return <LoadingSpinner fullScreen />;

  const unitNumber = (lease?.unit as any)?.unit_number ?? '-';
  const propertyName = (lease?.unit as any)?.property?.name ?? '-';
  const tenantName = tenant?.name ?? 'Tenant';
  const leaseSubtitle = lease ? `${propertyName} - Unit ${unitNumber}` : 'Tenant account';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <PageBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: PRIMARY, paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: 42, overflow: 'hidden' }}>
          <ProfileTexture />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>More</Text>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 3 }}>Account and documents</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tenant)/notifications', params: { from: 'profile' } } as any)}
              activeOpacity={0.75}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="notifications-outline" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={tenantName} size={64} />
            <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '900' }} numberOfLines={1}>{tenantName}</Text>
              <Text style={{ color: '#D7E3F6', fontSize: 13, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{leaseSubtitle}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: -22 }}>
          <Card padded={false} style={{ marginBottom: 14 }}>
            <AccountRow
              icon="person-circle-outline"
              title="Tenant Info"
              subtitle="Contact details, lease snapshot, and verification"
              onPress={() => router.push('/(tenant)/profile' as any)}
            />
            <AccountRow
              icon="folder-open-outline"
              title="Documents"
              subtitle="Receipts, bills, and shared files"
              onPress={() => router.push({ pathname: '/(tenant)/documents', params: { from: 'profile' } } as any)}
            />
            <AccountRow
              icon="clipboard-outline"
              title="House Rules"
              subtitle="Rules and policies from your landlord"
              onPress={() => router.push({ pathname: '/(tenant)/house-rules', params: { from: 'profile' } } as any)}
            />
            <AccountRow
              icon="notifications-outline"
              title="Notifications"
              subtitle="Payment, utility, and maintenance updates"
              onPress={() => router.push({ pathname: '/(tenant)/notifications', params: { from: 'profile' } } as any)}
            />
            <AccountRow
              icon="shield-checkmark-outline"
              title="Legal & Support"
              subtitle="Terms, privacy, and account deletion"
              onPress={() => router.push('/(tenant)/legal' as any)}
              last
            />
          </Card>

          <Button label="Sign Out" variant="danger" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
