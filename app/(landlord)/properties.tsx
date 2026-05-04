import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useProperties, PropertyWithUnits } from '../../lib/query/properties';

const PRIMARY = '#1B3C34';

function PropertyCard({ property }: { property: PropertyWithUnits }) {
  const units = property.unit ?? [];
  const total = units.length;
  const occupied = units.filter(u => u.status === 'occupied').length;
  const vacant = total - occupied;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={{ backgroundColor: '#fff', borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}
    >
      {/* Color banner */}
      <View style={{ height: 6, backgroundColor: PRIMARY }} />

      <View style={{ padding: 16 }}>
        {/* Name + chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{property.name}</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }} numberOfLines={2}>{property.address}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginTop: 2 }} />
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 }}>
          <Pill icon="grid-outline" value={`${total} units`} />
          <Pill icon="home-outline" value={`${occupied} occupied`} color="#15803D" />
          {vacant > 0 && <Pill icon="key-outline" value={`${vacant} vacant`} color="#B45309" />}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <OccupancyBar pct={occupancyPct} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Pill({ icon, value, color = '#6B7280' }: { icon: any; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={{ fontSize: 12, color, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

function OccupancyBar({ pct }: { pct: number }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{pct}% occupied</Text>
      <View style={{ width: 80, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }}>
        <View style={{ width: `${pct}%`, height: 4, backgroundColor: PRIMARY, borderRadius: 2 }} />
      </View>
    </View>
  );
}

export default function PropertiesScreen() {
  const [search, setSearch] = useState('');
  const { data: properties, isLoading, error } = useProperties();

  const filtered = (properties ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Properties</Text>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, height: 42 }}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search properties..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={{ color: '#6B7280', marginTop: 10, textAlign: 'center' }}>Failed to load properties</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="business-outline" size={48} color="#D1D5DB" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 }}>
            {search ? 'No results found' : 'No properties yet'}
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>
            {search ? 'Try a different search' : 'Tap + to add your first property'}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>{filtered.length} {filtered.length === 1 ? 'property' : 'properties'}</Text>
          {filtered.map(p => <PropertyCard key={p.id} property={p} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
