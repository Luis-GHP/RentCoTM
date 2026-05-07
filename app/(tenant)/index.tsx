import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/shared/Avatar';
import { BrandWordmark } from '../../components/shared/BrandLogo';
import { PageBackground } from '../../components/shared/PageBackground';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  useTenantActiveLease,
  useCurrentRentPayment,
  useRecentTenantPayments,
  useTenantUtilityBills,
  useTenantActiveRequests,
} from '../../lib/query/tenant-home';
import { useTenant } from '../../lib/query/tenants';
import { formatPHP, formatDate, getGreeting, getMonthName } from '../../lib/format';

const PRIMARY = '#2F4A7D';
const PRIMARY_DARK = '#1E3158';
const ACCENT = '#C34A1A';
const ACCENT_HERO = '#FFB14A';
const ACCENT_SOFT = '#FFF0EA';
const BACKGROUND = '#F7F6F3';
const SURFACE_MUTED = '#F1EFEC';
const BORDER = '#E4E0DC';
const BLUE_SOFT = '#EDF3FF';
const TEXT = '#111827';
const TEXT_MUTED = '#6B7280';
const SUCCESS = '#14804A';
const WARNING = '#D99A2B';
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
const FEATURE_CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 16px rgba(15, 23, 42, 0.08)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
});

function HeroTexture() {
  const arcs = [
    { top: -108, right: -300, opacity: 0.1 },
    { top: -78, right: -268, opacity: 0.082 },
    { top: -48, right: -236, opacity: 0.064 },
    { top: -18, right: -204, opacity: 0.05 },
    { top: 12, right: -172, opacity: 0.04 },
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
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.035)', top: 92, right: -130 }} />
      <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.028)', bottom: -86, left: -92 }} />
    </View>
  );
}

function heroAmount(amount: number | null | undefined) {
  const value = Number(amount ?? 0);
  const formatted = formatPHP(value);
  return Number.isInteger(value) ? formatted.replace(/\.00$/, '') : formatted;
}

function TenantSummaryCard({ leaseId, unitId, monthlyRent }: { leaseId: string; unitId?: string; monthlyRent: number }) {
  const router = useRouter();
  const { data: payment, isLoading: paymentLoading } = useCurrentRentPayment(leaseId);
  const { data: bills, isLoading: billsLoading } = useTenantUtilityBills(unitId);
  const { data: requests, isLoading: requestsLoading } = useTenantActiveRequests(unitId);
  const now = new Date();
  const label = `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  const status = payment?.status ?? 'unpaid';
  const amountDue = payment ? Number(payment.amount_due) : monthlyRent;
  const amountPaid = Number(payment?.amount_paid ?? 0);
  const rentDue = status === 'paid' ? 0 : Math.max(0, amountDue - amountPaid);
  const utilityDue = (bills ?? [])
    .filter(b => !['paid', 'confirmed'].includes(String(b.status).toLowerCase()))
    .reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0);
  const activeRequests = requests?.length ?? 0;

  return (
    <View
      style={{
        marginTop: 28,
        backgroundColor: 'rgba(30,49,88,0.88)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        padding: 18,
        ...SUMMARY_CARD_SHADOW,
      }}
    >
      <Text style={{ color: '#D7E3F6', fontSize: 14, fontWeight: '600', marginBottom: 14 }}>{label} Snapshot</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.push('/(tenant)/payments' as any)}
          activeOpacity={0.78}
          style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
            <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 11, fontWeight: '700' }}>RENT DUE</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.62)" />
          </View>
          {paymentLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{heroAmount(rentDue)}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tenant)/utilities' as any)}
          activeOpacity={0.78}
          style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
            <Text style={{ flex: 1, color: '#D7E3F6', fontSize: 11, fontWeight: '700' }}>UTILITIES</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.62)" />
          </View>
          {billsLoading ? (
            <ActivityIndicator color={ACCENT_HERO} />
          ) : (
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={{ color: ACCENT_HERO, fontSize: 20, fontWeight: '900' }}>{heroAmount(utilityDue)}</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push('/(tenant)/maintenance' as any)}
        activeOpacity={0.78}
        style={{ marginTop: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.065)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Ionicons name="construct-outline" size={17} color="#D7E3F6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#D7E3F6', fontSize: 11, fontWeight: '700' }}>REQUESTS</Text>
          {requestsLoading ? (
            <ActivityIndicator color={ACCENT_HERO} />
          ) : (
            <Text style={{ color: activeRequests > 0 ? ACCENT_HERO : '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 }}>
              {activeRequests} active
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.62)" />
      </TouchableOpacity>
    </View>
  );
}

function RentCard({ leaseId, unitNumber, monthlyRent }: { leaseId: string; unitNumber: string; monthlyRent: number }) {
  const router = useRouter();
  const { data: payment, isLoading } = useCurrentRentPayment(leaseId);
  const now = new Date();
  const period = `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  const status = payment?.status ?? 'unpaid';
  const amountDue = payment ? Number(payment.amount_due) : monthlyRent;
  const amountPaid = Number(payment?.amount_paid ?? 0);

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 18, borderWidth: 1, borderColor: BORDER, ...FEATURE_CARD_SHADOW }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: TEXT_MUTED }}>Rent - {period}</Text>
          <Text style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 2 }}>Unit {unitNumber}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={PRIMARY} />
      ) : (
        <>
          <Text style={{ fontSize: 32, fontWeight: '800', color: TEXT }}>{formatPHP(amountDue)}</Text>
          {status === 'partial' && (
            <Text style={{ fontSize: 13, color: WARNING, marginTop: 4 }}>
              {formatPHP(amountPaid)} paid - {formatPHP(amountDue - amountPaid)} remaining
            </Text>
          )}
          {payment?.payment_date && (
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              Paid on {formatDate(payment.payment_date)}
            </Text>
          )}
        </>
      )}

      {status !== 'paid' && (
        <TouchableOpacity
          onPress={() => router.push('/(tenant)/payments')}
          style={{ marginTop: 16, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Upload Payment Receipt</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RecentPayments({ leaseId }: { leaseId: string }) {
  const router = useRouter();
  const { data: payments, isLoading } = useRecentTenantPayments(leaseId);

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TEXT }}>Recent Payments</Text>
        <TouchableOpacity onPress={() => router.push('/(tenant)/payments')} activeOpacity={0.7}>
          <Text style={{ fontSize: 13, color: ACCENT, fontWeight: '700' }}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 20 }} />
        ) : (payments ?? []).length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No payment history yet</Text>
          </View>
        ) : (
          (payments ?? []).map((p, i) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => router.push(`/(tenant)/payments/${p.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < (payments!.length - 1) ? 1 : 0, borderBottomColor: SURFACE_MUTED }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EAF7EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="checkmark-circle" size={20} color={SUCCESS} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT }}>
                  {getMonthName(p.period_month)} {p.period_year}
                </Text>
                {p.payment_date && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Paid {formatDate(p.payment_date)}</Text>
                )}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: SUCCESS }}>{formatPHP(p.amount_paid)}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function UtilityBills({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { data: bills, isLoading } = useTenantUtilityBills(unitId);

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TEXT }}>Utility Bills</Text>
        <TouchableOpacity onPress={() => router.push('/(tenant)/utilities')} activeOpacity={0.7}>
          <Text style={{ fontSize: 13, color: ACCENT, fontWeight: '700' }}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 20 }} />
        ) : (bills ?? []).length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No utility bills yet</Text>
          </View>
        ) : (
          (bills ?? []).map((b, i) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => router.push(`/(tenant)/utilities/${b.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < (bills!.length - 1) ? 1 : 0, borderBottomColor: SURFACE_MUTED }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BLUE_SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="flash-outline" size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT }}>
                  {getMonthName(b.period_month)} {b.period_year}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{b.kwh_consumed} kWh</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT }}>{formatPHP(b.amount)}</Text>
                <StatusBadge status={b.status} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function MaintenanceSection({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { data: requests, isLoading } = useTenantActiveRequests(unitId);

  const priorityColor: Record<string, string> = {
    emergency: '#DC2626',
    high: ACCENT,
    medium: WARNING,
    low: TEXT_MUTED,
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TEXT }}>Maintenance</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tenant)/maintenance/new')}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: ACCENT_SOFT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
          activeOpacity={0.75}
        >
          <Ionicons name="add" size={15} color={ACCENT} />
          <Text style={{ fontSize: 12, color: ACCENT, fontWeight: '700', marginLeft: 2 }}>New Request</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
        {isLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ padding: 20 }} />
        ) : (requests ?? []).length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color="#D1D5DB" />
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>No active requests</Text>
          </View>
        ) : (
          (requests ?? []).map((r, i) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => router.push(`/(tenant)/maintenance/${r.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < (requests!.length - 1) ? 1 : 0, borderBottomColor: SURFACE_MUTED }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor[r.priority] ?? TEXT_MUTED, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1, textTransform: 'capitalize' }}>{r.status.replace('_', ' ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function TenantHero({
  tenantName,
  unitSubtitle,
  leaseId,
  unitId,
  monthlyRent,
}: {
  tenantName: string;
  unitSubtitle: string;
  leaseId?: string;
  unitId?: string;
  monthlyRent?: number;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const firstName = tenantName.split(' ')[0] || 'there';
  const hasLease = !!leaseId;

  return (
    <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: insets.top + 18, paddingBottom: hasLease ? 76 : 30, overflow: 'hidden' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <HeroTexture />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 34 }}>
        <BrandWordmark tone="white" markSize={42} textWidth={126} style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push('/(tenant)/notifications' as any)}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tenant)/more' as any)} activeOpacity={0.78}>
          <Avatar name={tenantName} size={42} />
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 25, fontWeight: '900', color: '#fff' }}>{getGreeting()},</Text>
      <Text style={{ fontSize: 27, fontWeight: '900', color: ACCENT_HERO, marginTop: 2 }}>{firstName}</Text>
      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 8 }} numberOfLines={1}>
        {unitSubtitle}
      </Text>
      {leaseId ? (
        <TenantSummaryCard
          leaseId={leaseId}
          unitId={unitId}
          monthlyRent={monthlyRent ?? 0}
        />
      ) : null}
    </View>
  );
}

export default function TenantHome() {
  const { profile, session } = useAuth();
  const tenantId = profile?.tenant_id ?? undefined;
  const tabBarHeight = useBottomTabBarHeight();

  const { data: lease, isLoading: leaseLoading, error: leaseError } = useTenantActiveLease(tenantId);
  const { data: tenant } = useTenant(tenantId);

  const unit = (lease?.unit as any) ?? null;
  const unitNumber = unit?.unit_number ?? '--';
  const unitId = unit?.id as string | undefined;
  const propertyName = unit?.property?.name ?? '';
  const tenantName = tenant?.name ?? session?.user.email?.split('@')[0] ?? 'there';
  const unitSubtitle = leaseLoading
    ? 'Loading your unit...'
    : leaseError
      ? "Couldn't load your unit"
      : lease
        ? `${propertyName ? `${propertyName} - ` : ''}Unit ${unitNumber}`
        : 'No active lease found';

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: BACKGROUND }}>
      <PageBackground tint="47,74,125" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: tabBarHeight + 32 }} showsVerticalScrollIndicator={false}>
        <TenantHero
          tenantName={tenantName}
          unitSubtitle={unitSubtitle}
          leaseId={lease?.id}
          unitId={unitId}
          monthlyRent={lease ? Number(lease.monthly_rent) : undefined}
        />

        {leaseLoading ? (
          <View style={{ minHeight: 320, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : leaseError ? (
          <View style={{ minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 }}>Could not load your unit</Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Reload the app after the latest Supabase migration is applied.</Text>
          </View>
        ) : !lease ? (
          <View style={{ minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Ionicons name="home-outline" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 }}>No active lease found</Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Contact your landlord if you think this is an error.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, marginTop: -46 }}>
            <RentCard leaseId={lease.id} unitNumber={unitNumber} monthlyRent={Number(lease.monthly_rent)} />
            <RecentPayments leaseId={lease.id} />
            {unitId ? <UtilityBills unitId={unitId} /> : null}
            {unitId ? <MaintenanceSection unitId={unitId} /> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
