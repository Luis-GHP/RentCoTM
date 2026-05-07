import { useMemo, useState } from 'react';
import { Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Card } from '../shared/Card';
import { EmptyState } from '../shared/EmptyState';
import { FilterTabs } from '../shared/FilterTabs';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { StatusBadge } from '../shared/StatusBadge';
import {
  DocumentCenterFilter,
  DocumentDocType,
  DocumentRow,
  useDocumentCenterDocuments,
} from '../../lib/query/documents';
import { formatDate } from '../../lib/format';
import { documentMatchesFilter, isDocumentImage } from '../../lib/domain/documents';

const PRIMARY = '#2F4A7D';

type Role = 'landlord' | 'tenant';

const FILTERS = [
  { key: 'all' as DocumentCenterFilter, label: 'All' },
  { key: 'receipts' as DocumentCenterFilter, label: 'Receipts' },
  { key: 'bills' as DocumentCenterFilter, label: 'Bills' },
  { key: 'maintenance' as DocumentCenterFilter, label: 'Maintenance' },
  { key: 'ids' as DocumentCenterFilter, label: 'IDs' },
  { key: 'official' as DocumentCenterFilter, label: 'Official' },
];

const DOC_META: Record<DocumentDocType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  photo:            { label: 'Photo', icon: 'image-outline', color: '#2F4A7D', bg: '#EDF3FF' },
  contract:         { label: 'Contract', icon: 'document-text-outline', color: '#2F4A7D', bg: '#EDF3FF' },
  gov_id:           { label: 'Government ID', icon: 'id-card-outline', color: '#2F4A7D', bg: '#EDF3FF' },
  gov_id_front:     { label: 'Government ID Front', icon: 'id-card-outline', color: '#2F4A7D', bg: '#EDF3FF' },
  gov_id_back:      { label: 'Government ID Back', icon: 'id-card-outline', color: '#2F4A7D', bg: '#EDF3FF' },
  receipt:          { label: 'Receipt', icon: 'receipt-outline', color: '#14804A', bg: '#EAF7EF' },
  bill:             { label: 'Bill', icon: 'document-attach-outline', color: '#D99A2B', bg: '#FFFBEB' },
  inspection_report:{ label: 'Inspection', icon: 'clipboard-outline', color: '#6B7280', bg: '#F1EFEC' },
  or_pdf:           { label: 'Official Receipt', icon: 'ribbon-outline', color: '#B45309', bg: '#FEF3C7' },
  utility_bill_pdf: { label: 'Utility Bill', icon: 'flash-outline', color: '#D99A2B', bg: '#FFFBEB' },
  other:            { label: 'Document', icon: 'document-outline', color: '#6B7280', bg: '#F1EFEC' },
};

function sourceLabel(doc: DocumentRow) {
  if (doc.entity_type === 'rent_payment') return 'Payment';
  if (doc.entity_type === 'utility_bill') return 'Utility';
  if (doc.entity_type === 'maintenance_request') return 'Maintenance';
  if (doc.entity_type === 'tenant') return 'Tenant profile';
  if (doc.entity_type === 'lease') return 'Lease';
  if (doc.entity_type === 'property') return 'Property';
  if (doc.entity_type === 'unit') return 'Unit';
  if (doc.entity_type === 'inspection') return 'Inspection';
  if (doc.entity_type === 'expense') return 'Expense';
  return 'Record';
}

function relatedRoute(role: Role, doc: DocumentRow) {
  if (role === 'landlord') {
    if (doc.entity_type === 'rent_payment') return `/(landlord)/payments/${doc.entity_id}`;
    if (doc.entity_type === 'utility_bill') return `/(landlord)/utilities/${doc.entity_id}`;
    if (doc.entity_type === 'maintenance_request') return `/(landlord)/maintenance/${doc.entity_id}`;
    if (doc.entity_type === 'tenant') return `/(landlord)/tenants/${doc.entity_id}`;
    if (doc.entity_type === 'property') return `/(landlord)/properties/${doc.entity_id}`;
  } else {
    if (doc.entity_type === 'rent_payment') return `/(tenant)/payments/${doc.entity_id}`;
    if (doc.entity_type === 'utility_bill') return `/(tenant)/utilities/${doc.entity_id}`;
    if (doc.entity_type === 'maintenance_request') return `/(tenant)/maintenance/${doc.entity_id}`;
  }
  return null;
}

export function DocumentCenterScreen({ role }: { role: Role }) {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { data, isLoading, error } = useDocumentCenterDocuments();
  const [filter, setFilter] = useState<DocumentCenterFilter>('all');
  const [selectedImage, setSelectedImage] = useState<DocumentRow | null>(null);

  const documents = useMemo(
    () => (data ?? []).filter(doc => documentMatchesFilter(doc, filter)),
    [data, filter]
  );
  const totalCount = data?.length ?? 0;
  const related = selectedImage ? relatedRoute(role, selectedImage) : null;

  async function openDocument(doc: DocumentRow) {
    if (isDocumentImage(doc)) {
      setSelectedImage(doc);
      return;
    }
    await WebBrowser.openBrowserAsync(doc.file_url);
  }

  function goRelated(doc: DocumentRow) {
    const route = relatedRoute(role, doc);
    if (route) router.push(route as any);
  }

  function goBack() {
    if (from === 'profile' && role === 'tenant') {
      router.replace('/(tenant)/more' as any);
      return;
    }
    router.back();
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Documents</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{totalCount} files available</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC' }}>
        <FilterTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't Load Documents" subtitle="Reload the app and try again." />
      ) : documents.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title={filter === 'all' ? 'No Documents Yet' : 'No Files Here Yet'}
          subtitle={filter === 'all' ? 'Uploaded receipts, bills, IDs, and photos will appear here.' : 'Try another filter or upload a related file first.'}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <Card padded={false}>
            {documents.map((doc, index) => {
              const meta = DOC_META[doc.doc_type] ?? DOC_META.other;
              const route = relatedRoute(role, doc);
              return (
                <View
                  key={doc.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: index < documents.length - 1 ? 1 : 0,
                    borderBottomColor: '#F1EFEC',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => openDocument(doc)}
                    activeOpacity={0.75}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
                        {doc.file_name ?? meta.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                        {meta.label} / {sourceLabel(doc)} / {formatDate(doc.uploaded_at)}
                      </Text>
                      <View style={{ alignSelf: 'flex-start', marginTop: 7 }}>
                        <StatusBadge status={doc.uploaded_by === 'tenant' ? 'tenant' : 'landlord'} />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {route ? (
                    <TouchableOpacity
                      onPress={() => goRelated(doc)}
                      activeOpacity={0.75}
                      style={{ marginLeft: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEC' }}
                    >
                      <Ionicons name="arrow-forward-outline" size={17} color={PRIMARY} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </ScrollView>
      )}

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.92)', padding: 16, justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.8}
            style={{ position: 'absolute', top: 54, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {selectedImage ? (
            <>
              <Image source={{ uri: selectedImage.file_url }} resizeMode="contain" style={{ width: '100%', height: '78%' }} />
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 12 }} numberOfLines={1}>
                {selectedImage.file_name ?? DOC_META[selectedImage.doc_type]?.label ?? 'Document'}
              </Text>
              <View style={{ flexDirection: 'row', alignSelf: 'center', gap: 10, marginTop: 16 }}>
                {related ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedImage(null);
                      router.push(related as any);
                    }}
                    activeOpacity={0.8}
                    style={{ borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>View Record</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => selectedImage && WebBrowser.openBrowserAsync(selectedImage.file_url)}
                  activeOpacity={0.8}
                  style={{ borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Open Original</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
