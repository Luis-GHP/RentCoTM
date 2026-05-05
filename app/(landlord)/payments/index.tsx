import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/shared/Avatar';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useAllPayments, PaymentRow } from '../../../lib/query/payments';
import { formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

type Filter = 'all' | 'pending' | 'paid' | 'overdue';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid',    label: 'Confirmed' },
  { key: 'overdue', label: 'Overdue' },
];

function primaryTenant(row: PaymentRow): string {
  const tenants = row.lease?.lease_tenant ?? [];
  const primary = tenants.find(lt => lt.role === 'primary') ?? tenants[0];
  return primary?.tenant?.name ?? 'Unknown';
}

function unitNumber(row: PaymentRow): string {
  return row.lease?.unit?.unit_number ?? '—';
}

function groupByPeriod(rows: PaymentRow[]): { key: string; label: string; items: PaymentRow[] }[] {
  const map = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    const key = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const [y, m] = key.split('-');
    return { key, label: `${getMonthName(parseInt(m))} ${y}`, items };
  });
}

function PaymentItem({ row, onPress }: { row: PaymentRow; onPress: () => void }) {
  const name = primaryTenant(row);
  const unit = unitNumber(row);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
    >
      <Avatar name={name} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{name}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Unit {unit}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 }}>{formatPHP(row.amount_due)}</Text>
        <StatusBadge status={row.status} />
      </View>
    </TouchableOpacity>
  );
}

function PeriodGroup({ label, items, onPressItem }: { label: string; items: PaymentRow[]; onPressItem: (id: string) => void }) {
  const collected = items.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid), 0);
  const total = items.reduce((s, i) => s + Number(i.amount_due), 0);

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#374151' }}>{label}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280' }}>{formatPHP(collected)} / {formatPHP(total)}</Text>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
        {items.map(row => (
          <PaymentItem key={row.id} row={row} onPress={() => onPressItem(row.id)} />
        ))}
      </View>
    </View>
  );
}

export default function PaymentsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const router = useRouter();
  const { data: payments, isLoading, error } = useAllPayments();

  const filtered = (payments ?? []).filter(p => filter === 'all' || p.status === filter);
  const groups = groupByPeriod(filtered);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Payments</Text>
          <TouchableOpacity
            onPress={() => router.push('/(landlord)/payments/record')}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: filter === f.key ? PRIMARY : '#F3F4F6' }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: filter === f.key ? '#fff' : '#6B7280' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load payments right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>No payments found</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4 }}>
            {filter !== 'all' ? 'Try a different filter' : 'Payments will appear here once recorded'}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {groups.map(g => (
            <PeriodGroup
              key={g.key}
              label={g.label}
              items={g.items}
              onPressItem={id => router.push(`/(landlord)/payments/${id}`)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
