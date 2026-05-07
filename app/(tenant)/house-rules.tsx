import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { formatDate } from '../../lib/format';
import { HouseRule, useTenantHouseRules } from '../../lib/query/house-rules';
import { getHouseRuleCategoryMeta } from '../../components/house-rules/houseRuleMeta';

const PRIMARY = '#2F4A7D';

export default function TenantHouseRulesScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { data: rules, isLoading, error } = useTenantHouseRules();
  const visibleRules = rules ?? [];
  const property = visibleRules[0]?.property ?? null;

  if (isLoading) return <LoadingSpinner fullScreen />;

  function goBack() {
    if (from === 'profile') {
      router.replace('/(tenant)/more' as any);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>House Rules</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            {property?.name ?? `${visibleRules.length} published rules`}
          </Text>
        </View>
      </View>

      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't Load House Rules" subtitle="Reload the app and try again." />
      ) : visibleRules.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="No House Rules Yet" subtitle="Published rules from your landlord will appear here." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {property ? (
            <Card style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="home-outline" size={20} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{property.name}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{property.address}</Text>
                </View>
              </View>
            </Card>
          ) : null}

          {visibleRules.map(rule => <TenantRuleCard key={rule.id} rule={rule} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TenantRuleCard({ rule }: { rule: HouseRule }) {
  const meta = getHouseRuleCategoryMeta(rule.category);
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={meta.icon} size={20} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{rule.title}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 3, marginBottom: 10 }}>
            {meta.label} / Updated {formatDate(rule.updated_at)}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: '#374151' }}>{rule.body}</Text>
        </View>
      </View>
    </Card>
  );
}
