import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppModal } from '../../components/shared/AppModal';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { formatDate } from '../../lib/format';
import {
  HouseRule,
  useDeleteHouseRule,
  useHouseRuleProperties,
  useLandlordHouseRules,
  useSaveHouseRule,
  useSetHouseRulePublished,
} from '../../lib/query/house-rules';
import {
  HouseRuleEditorModal,
  HouseRuleEditorState,
} from '../../components/house-rules/HouseRuleEditorModal';
import { getHouseRuleCategoryMeta } from '../../components/house-rules/houseRuleMeta';

const PRIMARY = '#2F4A7D';

function createDraft(propertyId: string): HouseRuleEditorState {
  return {
    propertyId,
    title: '',
    body: '',
    category: 'general',
    isPublished: true,
    sortOrder: 0,
  };
}

function editDraft(rule: HouseRule): HouseRuleEditorState {
  return {
    id: rule.id,
    propertyId: rule.property_id,
    title: rule.title,
    body: rule.body,
    category: rule.category,
    isPublished: rule.is_published,
    sortOrder: rule.sort_order,
  };
}

export default function LandlordHouseRulesScreen() {
  const router = useRouter();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const { data: properties, isLoading: propertiesLoading, error: propertiesError } = useHouseRuleProperties();
  const { data: rules, isLoading: rulesLoading, error: rulesError } = useLandlordHouseRules(selectedPropertyId);
  const saveRule = useSaveHouseRule();
  const publishRule = useSetHouseRulePublished();
  const deleteRule = useDeleteHouseRule();
  const [editor, setEditor] = useState<HouseRuleEditorState | null>(null);
  const [editorError, setEditorError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<HouseRule | null>(null);

  const propertyList = properties ?? [];
  const isLoading = propertiesLoading || rulesLoading;
  const visibleRules = useMemo(() => rules ?? [], [rules]);
  const publishedCount = useMemo(() => visibleRules.filter(rule => rule.is_published).length, [visibleRules]);

  function openNewRule() {
    const propertyId = selectedPropertyId ?? propertyList[0]?.id;
    if (!propertyId) return;
    setEditor(createDraft(propertyId));
    setEditorError('');
  }

  async function handleSave() {
    if (!editor) return;
    if (!editor.propertyId) {
      setEditorError('Select a property for this rule.');
      return;
    }
    if (!editor.title.trim()) {
      setEditorError('Add a short title.');
      return;
    }
    if (!editor.body.trim()) {
      setEditorError('Add the rule details.');
      return;
    }

    try {
      await saveRule.mutateAsync({
        id: editor.id,
        propertyId: editor.propertyId,
        title: editor.title,
        body: editor.body,
        category: editor.category,
        isPublished: editor.isPublished,
        sortOrder: editor.sortOrder,
      });
      setEditor(null);
      setEditorError('');
    } catch {
      setEditorError('Could not save this rule. Check the SQL migration and try again.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
    }
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>House Rules</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            {publishedCount} published / {visibleRules.length} total
          </Text>
        </View>
        <TouchableOpacity
          onPress={openNewRule}
          disabled={propertyList.length === 0}
          activeOpacity={0.75}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: propertyList.length ? PRIMARY : '#E4E0DC', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {propertiesError || rulesError ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't Load House Rules" subtitle="Run SQL 14, reload Expo, then try again." />
      ) : propertyList.length === 0 ? (
        <EmptyState
          icon="home-outline"
          title="Add A Property First"
          subtitle="House rules are attached to a property so tenants only see the rules that apply to their unit."
          actionLabel="Add Property"
          onAction={() => router.push('/(landlord)/properties/add' as any)}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
            <FilterChip label="All Properties" active={!selectedPropertyId} onPress={() => setSelectedPropertyId(null)} />
            {propertyList.map(property => (
              <FilterChip
                key={property.id}
                label={property.name}
                active={selectedPropertyId === property.id}
                onPress={() => setSelectedPropertyId(property.id)}
              />
            ))}
          </ScrollView>

          {visibleRules.length === 0 ? (
            <View style={{ minHeight: 360 }}>
              <EmptyState
                icon="clipboard-outline"
                title="No House Rules Yet"
                subtitle="Create the first rule for payments, utilities, visitors, quiet hours, or move-out expectations."
                actionLabel="Create Rule"
                onAction={openNewRule}
              />
            </View>
          ) : (
            visibleRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => {
                  setEditor(editDraft(rule));
                  setEditorError('');
                }}
                onTogglePublished={() => publishRule.mutate({ id: rule.id, isPublished: !rule.is_published })}
                onDelete={() => setDeleteTarget(rule)}
              />
            ))
          )}
        </ScrollView>
      )}

      <HouseRuleEditorModal
        visible={!!editor}
        value={editor}
        properties={propertyList}
        error={editorError}
        loading={saveRule.isPending}
        onChange={setEditor}
        onCancel={() => setEditor(null)}
        onSave={handleSave}
      />

      <AppModal
        visible={!!deleteTarget}
        title="Delete this rule?"
        message="Tenants will no longer see it, and this cannot be undone."
        tone="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={deleteRule.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: active ? PRIMARY : '#FFFFFF',
        borderWidth: active ? 0 : 1,
        borderColor: '#E4E0DC',
      }}
    >
      <Text style={{ color: active ? '#FFFFFF' : '#374151', fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function RuleCard({
  rule,
  onEdit,
  onTogglePublished,
  onDelete,
}: {
  rule: HouseRule;
  onEdit: () => void;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  const meta = getHouseRuleCategoryMeta(rule.category);
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={meta.icon} size={20} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' }}>{rule.title}</Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: rule.is_published ? '#EDF3FF' : '#F1EFEC' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: rule.is_published ? PRIMARY : '#6B7280' }}>
                {rule.is_published ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
            {meta.label} / {rule.property?.name ?? 'Property'} / Updated {formatDate(rule.updated_at)}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#374151' }}>{rule.body}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <ActionButton icon="create-outline" label="Edit" onPress={onEdit} />
        <ActionButton icon={rule.is_published ? 'eye-off-outline' : 'eye-outline'} label={rule.is_published ? 'Unpublish' : 'Publish'} onPress={onTogglePublished} />
        <ActionButton icon="trash-outline" label="Delete" danger onPress={onDelete} />
      </View>
    </Card>
  );
}

function ActionButton({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? '#DC2626' : PRIMARY;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flex: 1,
        height: 40,
        borderRadius: 12,
        backgroundColor: danger ? '#FEF2F2' : '#F1EFEC',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ marginLeft: 5, color, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );
}
