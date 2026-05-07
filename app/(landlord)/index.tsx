import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar } from '../../components/shared/Avatar';
import { BrandMark, BrandText, BrandWordmark } from '../../components/shared/BrandLogo';
import { PageBackground } from '../../components/shared/PageBackground';
import { useLandlordInfo, useMonthlySummary, usePortfolioOverview, useAlerts } from '../../lib/query/dashboard';
import { formatPHP, getGreeting, getMonthName } from '../../lib/format';

const PRIMARY = '#2F4A7D';
const PRIMARY_DARK = '#1E3158';
const ACCENT_HERO = '#FFB14A';
const SUMMARY_CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 12px 20px rgba(30, 49, 88, 0.24)' },
  default: {
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
});
const PORTFOLIO_CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 16px rgba(15, 23, 42, 0.12)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 7,
  },
});

function HeroTexture() {
  const arcs = [
    { top: -100, right: -300, opacity: 0.1 },
    { top: -70, right: -270, opacity: 0.085 },
    { top: -40, right: -240, opacity: 0.07 },
    { top: -10, right: -210, opacity: 0.055 },
    { top: 20, right: -180, opacity: 0.045 },
  ];

  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {arcs.map((arc, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: arc.top,
            right: arc.right,
            width: 560,
            height: 330,
            borderRadius: 280,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${arc.opacity})`,
            transform: [{ rotate: '-16deg' }],
          }}
        />
      ))}
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.035)', top: 78, right: -130 }} />
    </View>
  );
}

function SummaryCard() {
  const router = useRouter();
  const { data, isLoading } = useMonthlySummary();
  const now = new Date();
  const label = `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  function heroAmount(amount: number | null | undefined) {
    const value = Number(amount ?? 0);
    const formatted = formatPHP(value);
    return Number.isInteger(value) ? formatted.replace(/\.00$/, '') : formatted;
  }

  return (
    <View
      style={{
        marginTop: 30,
        backgroundColor: 'rgba(30,49,88,0.88)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        padding: 18,
        ...SUMMARY_CARD_SHADOW,
      }}
    >
      <Text style={{ color: '#D7E3F6', fontSize: 14, fontWeight: '600', marginBottom: 14 }}>{label} Summary</Text>
      {isLoading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
      ) : (
        <View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(landlord)/payments', params: { filter: 'paid' } } as any)}
              activeOpacity={0.78}
              style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 11, fontWeight: '700' }}>COLLECTED</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.62)" />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{heroAmount(data?.collected)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(landlord)/payments', params: { filter: 'pending' } } as any)}
              activeOpacity={0.78}
              style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 11, fontWeight: '700' }}>PENDING</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.62)" />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={{ color: ACCENT_HERO, fontSize: 20, fontWeight: '900' }}>{heroAmount(data?.pending)}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(landlord)/payments', params: { filter: 'overdue' } } as any)}
            activeOpacity={0.78}
            style={{ marginTop: 10, borderRadius: 16, backgroundColor: 'rgba(252,165,165,0.105)', borderWidth: 1, borderColor: 'rgba(252,165,165,0.18)', padding: 12, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(252,165,165,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#FCA5A5', fontSize: 11, fontWeight: '700' }}>OVERDUE</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.56} style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{heroAmount(data?.overdue)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.62)" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function DashboardHero({ landlordName }: { landlordName: string }) {
  const router = useRouter();
  const { data: landlord } = useLandlordInfo();
  const greeting = getGreeting();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: insets.top + 18, paddingBottom: 76, overflow: 'hidden' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <HeroTexture />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 34 }}>
        <BrandWordmark tone="white" markSize={42} textWidth={126} style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push('/(landlord)/notifications' as any)}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        {landlord && (
          <TouchableOpacity onPress={() => router.push('/(landlord)/more')} activeOpacity={0.7}>
            <Avatar name={landlord.name} size={42} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: 25, fontWeight: '900', color: '#fff' }}>{greeting},</Text>
      <Text style={{ fontSize: 27, fontWeight: '900', color: ACCENT_HERO, marginTop: 2 }}>{landlordName.split(' ')[0]}</Text>
      <SummaryCard />
    </View>
  );
}

function PortfolioCard() {
  const { data, isLoading } = usePortfolioOverview();
  const occupancy = data && data.unitCount > 0
    ? Math.round((data.occupiedCount / data.unitCount) * 100)
    : 0;

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#F1EFEC', ...PORTFOLIO_CARD_SHADOW }}>
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

function NeedsAttentionPanel() {
  const router = useRouter();
  const { data, isLoading } = useAlerts();

  const items = [
    { count: data?.overduePayments ?? 0, label: 'Overdue Payments', detail: 'Follow up on unpaid rent', color: '#DC2626', bg: '#FEF2F2', icon: 'warning-outline' as const, route: '/(landlord)/payments' },
    { count: data?.pendingConfirmations ?? 0, label: 'Pending Payments', detail: 'Review payments waiting for action', color: '#2F4A7D', bg: '#EDF3FF', icon: 'receipt-outline' as const, route: '/(landlord)/payments' },
    { count: data?.expiringLeases ?? 0, label: 'Expiring Leases', detail: 'Leases ending within 30 days', color: '#B45309', bg: '#FFFBEB', icon: 'time-outline' as const, route: '/(landlord)/tenants' },
  ].filter(a => a.count > 0);

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' }}>Needs Attention</Text>
        <TouchableOpacity onPress={() => router.push('/(landlord)/payments')} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY }}>Review</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F1EFEC', overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 22 }} />
        ) : items.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="checkmark-done-outline" size={20} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>All caught up</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>No overdue payments or expiring leases right now</Text>
            </View>
          </View>
        ) : items.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < items.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.detail}</Text>
            </View>
            <View style={{ minWidth: 28, height: 28, borderRadius: 14, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{item.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function QuickActions() {
  const router = useRouter();

  const actions = [
    { icon: 'business-outline' as const, label: 'Add Property', route: '/(landlord)/properties/add' },
    { icon: 'person-add-outline' as const, label: 'Add Tenant', route: '/(landlord)/tenants/invite' },
    { icon: 'cash-outline' as const, label: 'Record Payment', route: '/(landlord)/payments/record' },
    { icon: 'document-text-outline' as const, label: 'Upload Utility Bill', route: '/(landlord)/utilities/upload' },
  ];

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Quick Actions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {actions.map(a => (
          <TouchableOpacity
            key={a.label}
            onPress={() => router.push(a.route as any)}
            style={{ width: '47.5%', backgroundColor: '#F7F6F3', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E4E0DC' }}
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

function DashboardAccent() {
  const now = new Date();
  const label = `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  return (
    <View style={{ height: 84, borderRadius: 18, backgroundColor: '#EDF3FF', borderWidth: 1, borderColor: '#D8E2F2', overflow: 'hidden', marginBottom: 8 }}>
      <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <View style={{ position: 'absolute', top: -40, right: -60, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(47,74,125,0.06)' }} />
        <View style={{ position: 'absolute', bottom: 16, left: 22, width: 92, height: 1, backgroundColor: 'rgba(47,74,125,0.16)' }} />
        <View style={{ position: 'absolute', bottom: 28, left: 22, width: 56, height: 1, backgroundColor: 'rgba(47,74,125,0.12)' }} />
        <View style={{ position: 'absolute', top: 18, right: 28, width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(47,74,125,0.12)' }} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <BrandMark tone="white" size={25} />
        </View>
        <View style={{ flex: 1 }}>
          <BrandText tone="blue" width={70} />
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

export default function LandlordDashboard() {
  const { data: landlord } = useLandlordInfo();
  const name = landlord?.name ?? 'there';
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: tabBarHeight + 32 }} showsVerticalScrollIndicator={false}>
        <DashboardHero landlordName={name} />
        <View style={{ paddingHorizontal: 20, marginTop: -46 }}>
          <PortfolioCard />
          <QuickActions />
          <NeedsAttentionPanel />
          <DashboardAccent />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
