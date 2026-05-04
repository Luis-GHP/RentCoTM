import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { useLandlordInfo, useMonthlySummary, usePortfolioOverview, useAlerts } from '../../lib/query/dashboard';
import { formatPHP, getGreeting, getMonthName } from '../../lib/format';

const PRIMARY = '#1B3C34';

function SummaryCard() {
  const { data, isLoading } = useMonthlySummary();
  const now = new Date();
  const label = `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  return (
    <View style={{ backgroundColor: PRIMARY, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>{label} Summary</Text>
      {isLoading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 4 }}>COLLECTED</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{formatPHP(data?.collected)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 4 }}>PENDING</Text>
            <Text style={{ color: '#FCD34D', fontSize: 20, fontWeight: '700' }}>{formatPHP(data?.pending)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16 }} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 4 }}>OVERDUE</Text>
            <Text style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '700' }}>{formatPHP(data?.overdue)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PortfolioCard() {
  const { data, isLoading } = usePortfolioOverview();
  const occupancy = data && data.unitCount > 0
    ? Math.round((data.occupiedCount / data.unitCount) * 100)
    : 0;

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Portfolio Overview</Text>
      {isLoading ? (
        <ActivityIndicator color={PRIMARY} />
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <StatItem value={data?.propertyCount ?? 0} label="Properties" />
          <StatItem value={data?.unitCount ?? 0} label="Total Units" />
          <StatItem value={data?.occupiedCount ?? 0} label="Occupied" />
          <StatItem value={`${occupancy}%`} label="Occupancy" accent />
        </View>
      )}
    </View>
  );
}

function StatItem({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: accent ? PRIMARY : '#111827' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function AlertsSection() {
  const { data, isLoading } = useAlerts();

  if (isLoading) return null;

  const alerts = [
    { count: data?.overduePayments ?? 0, label: 'Overdue Payments', color: '#DC2626', bg: '#FEF2F2', icon: 'warning-outline' as const },
    { count: data?.expiringLeases ?? 0, label: 'Expiring Leases', color: '#B45309', bg: '#FFFBEB', icon: 'time-outline' as const },
    { count: data?.pendingConfirmations ?? 0, label: 'Pending Confirmations', color: '#1D4ED8', bg: '#EFF6FF', icon: 'checkmark-circle-outline' as const },
  ].filter(a => a.count > 0);

  if (alerts.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Alerts</Text>
      {alerts.map(a => (
        <View key={a.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: a.bg, borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <Ionicons name={a.icon} size={20} color={a.color} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, color: '#111827' }}>{a.label}</Text>
          <View style={{ backgroundColor: a.color, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{a.count}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function QuickActions() {
  const router = useRouter();

  const actions = [
    { icon: 'business-outline' as const,    label: 'Add Property',      route: '/(landlord)/properties/add' },
    { icon: 'person-add-outline' as const,  label: 'Add Tenant',        route: '/(landlord)/tenants/invite' },
    { icon: 'cash-outline' as const,        label: 'Record Payment',    route: '/(landlord)/payments/record' },
    { icon: 'document-text-outline' as const, label: 'Upload Utility Bill', route: '/(landlord)/utilities' },
  ];

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Quick Actions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {actions.map(a => (
          <TouchableOpacity
            key={a.label}
            onPress={() => router.push(a.route as any)}
            style={{ width: '47.5%', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}
            activeOpacity={0.7}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${PRIMARY}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Ionicons name={a.icon} size={22} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' }}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function LandlordDashboard() {
  const { profile } = useAuth();
  const { data: landlord } = useLandlordInfo();
  const name = landlord?.name ?? 'there';
  const greeting = getGreeting();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: PRIMARY, letterSpacing: -0.5 }}>RentCo</Text>
        <TouchableOpacity style={{ marginRight: 12 }} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={24} color="#374151" />
        </TouchableOpacity>
        {landlord && <Avatar name={landlord.name} size={34} />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>{greeting},</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: PRIMARY }}>{name.split(' ')[0]} 👋</Text>
        </View>

        <SummaryCard />
        <PortfolioCard />
        <AlertsSection />
        <QuickActions />
      </ScrollView>
    </SafeAreaView>
  );
}
