import { View, Text, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useDocumentsForEntity, useUploadDocument } from '../../../lib/query/documents';
import { useTenantUtilityBill } from '../../../lib/query/tenant-home';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

function isFuturePeriod(month: number, year: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month > currentMonth);
}

export default function TenantUtilityBillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: bill, isLoading, error } = useTenantUtilityBill(id);
  const { data: documents } = useDocumentsForEntity('utility_bill', id);
  const uploadDocument = useUploadDocument();

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !bill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load utility bill right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentBill = bill;
  const billDocs = (documents ?? []).filter(doc => ['bill', 'utility_bill_pdf'].includes(doc.doc_type));
  const advance = isFuturePeriod(currentBill.period_month, currentBill.period_year);
  const unitLabel = currentBill.unit
    ? `Unit ${currentBill.unit.unit_number}${currentBill.unit.property?.name ? ` - ${currentBill.unit.property.name}` : ''}`
    : 'Unit not set';

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await uploadDocument.mutateAsync({
        entityType: 'utility_bill',
        entityId: currentBill.id,
        docType: 'bill',
        uri: asset.uri,
        fileName: asset.name,
        contentType: asset.mimeType ?? 'application/pdf',
        uploadedBy: 'tenant',
      });
      Alert.alert('Bill Uploaded', 'Your landlord can review the uploaded bill.');
    } catch {
      Alert.alert('Upload Failed', 'Could not upload this PDF right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Utility Bill</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unitLabel}</Text>
        </View>
        <StatusBadge status={currentBill.status} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {advance ? (
          <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
            <StatusBadge status="advance" />
          </View>
        ) : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, color: '#6B7280', textTransform: 'capitalize' }}>{currentBill.utility_type} bill</Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827', marginTop: 4 }}>{formatPHP(currentBill.amount)}</Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{getMonthName(currentBill.period_month)} {currentBill.period_year}</Text>
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <ListRow label="Provider" value={currentBill.provider} showDivider />
          <ListRow label="kWh Consumed" value={currentBill.kwh_consumed == null ? 'Not set' : `${currentBill.kwh_consumed} kWh`} showDivider />
          <ListRow label="Rate per kWh" value={currentBill.rate_per_kwh == null ? 'Not set' : formatPHP(currentBill.rate_per_kwh)} showDivider />
          <ListRow label="Reading Start" value={currentBill.reading_start == null ? 'Not set' : String(currentBill.reading_start)} showDivider />
          <ListRow label="Reading End" value={currentBill.reading_end == null ? 'Not set' : String(currentBill.reading_end)} showDivider />
          <ListRow label="Confirmed At" value={currentBill.confirmed_at ? formatDate(currentBill.confirmed_at) : 'Pending review'} showDivider={false} />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Bill Files</Text>
          {currentBill.bill_pdf_url ? (
            <TouchableOpacity onPress={() => Linking.openURL(currentBill.bill_pdf_url!)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: billDocs.length > 0 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
              <Ionicons name="document-text-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Original Bill</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Uploaded by {currentBill.uploaded_by}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}

          {billDocs.length === 0 && !currentBill.bill_pdf_url ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No PDF uploaded yet</Text>
          ) : billDocs.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => Linking.openURL(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < billDocs.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
            >
              <Ionicons name="document-attach-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{doc.file_name ?? 'Bill PDF'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </Card>

        <Button label="Upload Bill PDF" loading={uploadDocument.isPending} onPress={pickPdf} />
      </ScrollView>
    </SafeAreaView>
  );
}
