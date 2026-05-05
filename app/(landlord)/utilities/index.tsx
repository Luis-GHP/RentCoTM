import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { EmptyState } from '../../../components/shared/EmptyState';
import { FilterTabs } from '../../../components/shared/FilterTabs';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useAllUtilityBills, UtilityBillRow, UtilityFilter } from '../../../lib/query/utilities';
import { formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

const FILTERS = [
  { key: 'all' as UtilityFilter, label: 'All' },
  { key: 'pending' as UtilityFilter, label: 'Pending' },
  { key: 'confirmed' as UtilityFilter, label: 'Confirmed' },
];

const UTILITY_ICON: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  electric: { icon: 'flash-outline', color: '#D97706', bg: '#FFFBEB' },
  water: { icon: 'water-outline', color: '#2563EB', bg: '#EFF6FF' },
  internet: { icon: 'wifi-outline', color: '#7C3AED', bg: '#F5F3FF' },
  other: { icon: 'receipt-outline', color: '#6B7280', bg: '#F3F4F6' },
};

function groupByUnit(bills: UtilityBillRow[]) {
  const groups = new Map<string, { label: string; bills: UtilityBillRow[] }>();
  for (const bill of bills) {
    const key = bill.unit?.id ?? bill.unit_id;
    const label = `Unit ${bill.unit?.unit_number ?? '-'}${bill.unit?.property?.name ? ` - ${bill.unit.property.name}` : ''}`;
    if (!groups.has(key)) groups.set(key, { label, bills: [] });
    groups.get(key)!.bills.push(bill);
  }
  return Array.from(groups.values());
}

export default function UtilitiesScreen() {
  const [filter, setFilter] = useState<UtilityFilter>('all');
  const router = useRouter();
  const { data: bills, isLoading, error } = useAllUtilityBills(filter);
  const groups = groupByUnit(bills ?? []);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Utilities</Text>
          <TouchableOpacity onPress={() => router.push('/(landlord)/utilities/upload')} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={24} color={PRIMARY} />
          </TouchableOpacity>
        </View>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load utility bills right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      ) : groups.length === 0 ? (
        <EmptyState icon="flash-outline" title="No Utility Bills Yet" subtitle="Tap the upload icon to add your first bill." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {groups.map(group => (
            <View key={group.label} style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 }}>{group.label}</Text>
              <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
                {group.bills.map((bill, index) => {
                  const icon = UTILITY_ICON[bill.utility_type] ?? UTILITY_ICON.other;
                  return (
                    <TouchableOpacity
                      key={bill.id}
                      onPress={() => router.push(`/(landlord)/utilities/${bill.id}`)}
                      activeOpacity={0.75}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < group.bills.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: icon.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name={icon.icon} size={19} color={icon.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', textTransform: 'capitalize' }}>
                          {bill.utility_type} - {getMonthName(bill.period_month)} {bill.period_year}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{bill.provider}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{formatPHP(bill.amount)}</Text>
                        <StatusBadge status={bill.confirmed_at ? 'confirmed' : 'pending'} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
