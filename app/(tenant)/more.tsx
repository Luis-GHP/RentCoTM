import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { Card } from '../../components/shared/Card';
import { ListRow } from '../../components/shared/ListRow';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useTenant } from '../../lib/query/tenants';
import { useTenantActiveLease } from '../../lib/query/tenant-home';
import { formatPHP, formatDate } from '../../lib/format';

export default function TenantMore() {
  const { profile, signOut } = useAuth();
  const { data: tenant, isLoading: tenantLoading } = useTenant(profile?.tenant_id ?? undefined);
  const { data: lease, isLoading: leaseLoading } = useTenantActiveLease(profile?.tenant_id ?? undefined);

  const isLoading = tenantLoading || leaseLoading;

  if (isLoading) return <LoadingSpinner fullScreen />;

  const unitNumber   = (lease?.unit as any)?.unit_number ?? '—';
  const propertyName = (lease?.unit as any)?.property?.name ?? '—';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>Profile</Text>

        {/* Profile card */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Avatar name={tenant?.name ?? 'T'} size={56} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{tenant?.name ?? '—'}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Tenant</Text>
            </View>
          </View>
          <ListRow label="Phone" value={tenant?.phone ?? 'Not set'} showDivider />
          <ListRow label="Email" value={tenant?.email ?? 'Not set'} showDivider={false} />
        </Card>

        {/* Lease summary */}
        {lease && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Lease Summary</Text>
            <ListRow label="Unit"             value={`Unit ${unitNumber} · ${propertyName}`} showDivider />
            <ListRow label="Lease Start"      value={formatDate(lease.start_date)} showDivider />
            <ListRow label="Lease End"        value={formatDate(lease.end_date)} showDivider />
            <ListRow label="Monthly Rent"     value={formatPHP(Number(lease.monthly_rent))} showDivider />
            <ListRow label="Security Deposit" value={formatPHP(Number(lease.security_deposit))} showDivider={false} />
          </Card>
        )}

        {/* Sign out */}
        <Button label="Sign Out" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
