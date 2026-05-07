import { Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../shared/Button';
import { HouseRuleCategory, HouseRuleProperty } from '../../lib/query/house-rules';
import { HOUSE_RULE_CATEGORIES } from './houseRuleMeta';

const PRIMARY = '#2F4A7D';

export type HouseRuleEditorState = {
  id?: string | null;
  propertyId: string;
  title: string;
  body: string;
  category: HouseRuleCategory;
  isPublished: boolean;
  sortOrder: number;
};

type Props = {
  visible: boolean;
  value: HouseRuleEditorState | null;
  properties: HouseRuleProperty[];
  error?: string;
  loading?: boolean;
  onChange: (value: HouseRuleEditorState) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function HouseRuleEditorModal({
  visible,
  value,
  properties,
  error,
  loading,
  onChange,
  onCancel,
  onSave,
}: Props) {
  if (!value) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.44)', padding: 18, justifyContent: 'center' }}>
        <View style={{ maxHeight: '88%', backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' }}>
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: '#F1EFEC', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>
                {value.id ? 'Edit Rule' : 'New Rule'}
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                Publish only when the wording is ready for tenants.
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? (
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700' }}>{error}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 }}>Property</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
              {properties.map(property => {
                const selected = property.id === value.propertyId;
                return (
                  <TouchableOpacity
                    key={property.id}
                    onPress={() => onChange({ ...value, propertyId: property.id })}
                    activeOpacity={0.75}
                    style={{
                      paddingHorizontal: 13,
                      paddingVertical: 9,
                      borderRadius: 18,
                      backgroundColor: selected ? PRIMARY : '#F1EFEC',
                    }}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : '#374151', fontSize: 13, fontWeight: '800' }}>
                      {property.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {HOUSE_RULE_CATEGORIES.map(category => {
                const selected = category.key === value.category;
                return (
                  <TouchableOpacity
                    key={category.key}
                    onPress={() => onChange({ ...value, category: category.key })}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 11,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: selected ? '#EDF3FF' : '#F1EFEC',
                      borderWidth: selected ? 1 : 0,
                      borderColor: '#D8E2F2',
                    }}
                  >
                    <Ionicons name={category.icon} size={15} color={selected ? PRIMARY : '#6B7280'} />
                    <Text style={{ marginLeft: 6, color: selected ? PRIMARY : '#4B5563', fontSize: 12, fontWeight: '800' }}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field
              label="Title"
              value={value.title}
              placeholder="Example: Quiet hours"
              onChangeText={title => onChange({ ...value, title })}
            />

            <Field
              label="Rule Details"
              value={value.body}
              placeholder="Write the policy in clear tenant-facing language."
              onChangeText={body => onChange({ ...value, body })}
              multiline
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F6F3', borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>Publish for tenants</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Draft rules stay hidden from tenant accounts.</Text>
              </View>
              <Switch
                value={value.isPublished}
                onValueChange={isPublished => onChange({ ...value, isPublished })}
                trackColor={{ false: '#D1D5DB', true: '#D8E2F2' }}
                thumbColor={value.isPublished ? PRIMARY : '#FFFFFF'}
              />
            </View>

            <Button label={value.id ? 'Save Changes' : 'Create Rule'} loading={loading} onPress={onSave} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 132 : 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E4E0DC',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          fontSize: 14,
          lineHeight: multiline ? 20 : undefined,
          color: '#111827',
        }}
      />
    </View>
  );
}
