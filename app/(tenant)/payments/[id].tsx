import { View, Text, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useDocumentsForEntity, useUploadDocument } from '../../../lib/query/documents';
import { useTenantPayment } from '../../../lib/query/tenant-home';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

function isFuturePeriod(month: number, year: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month > currentMonth);
}

export default function TenantPaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: payment, isLoading, error } = useTenantPayment(id);
  const { data: documents } = useDocumentsForEntity('rent_payment', id);
  const uploadDocument = useUploadDocument();

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !payment) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load payment right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentPayment = payment;
  const receiptDocs = (documents ?? []).filter(doc => doc.doc_type === 'receipt');
  const canUploadReceipt = ['pending', 'unpaid', 'overdue'].includes(currentPayment.status);
  const advance = isFuturePeriod(currentPayment.period_month, currentPayment.period_year);
  const unitLabel = currentPayment.lease?.unit
    ? `Unit ${currentPayment.lease.unit.unit_number}${currentPayment.lease.unit.property?.name ? ` - ${currentPayment.lease.unit.property.name}` : ''}`
    : 'Unit not set';

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await uploadDocument.mutateAsync({
        entityType: 'rent_payment',
        entityId: currentPayment.id,
        docType: 'receipt',
        uri: asset.uri,
        fileName: asset.fileName ?? `receipt-${Date.now()}.jpg`,
        contentType: asset.mimeType,
        uploadedBy: 'tenant',
      });
      Alert.alert('Receipt Uploaded', 'Your landlord can now review the receipt.');
    } catch {
      Alert.alert('Upload Failed', 'Could not upload this receipt right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Payment Detail</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unitLabel}</Text>
        </View>
        <StatusBadge status={currentPayment.status} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {advance ? (
          <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
            <StatusBadge status="advance" />
          </View>
        ) : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, color: '#6B7280' }}>{getMonthName(currentPayment.period_month)} {currentPayment.period_year}</Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827', marginTop: 4 }}>{formatPHP(currentPayment.amount_due)}</Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{formatPHP(currentPayment.amount_paid)} paid</Text>
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <ListRow label="Payment Date" value={currentPayment.payment_date ? formatDate(currentPayment.payment_date) : 'Not paid yet'} showDivider />
          <ListRow label="Method" value={currentPayment.payment_method ?? 'Not set'} showDivider />
          <ListRow label="Reference" value={currentPayment.reference_number ?? 'Not set'} showDivider />
          <ListRow label="Official Receipt" value={currentPayment.or_number ?? 'Not issued yet'} showDivider />
          <ListRow label="Confirmed At" value={currentPayment.confirmed_at ? formatDate(currentPayment.confirmed_at) : 'Not confirmed yet'} showDivider={false} />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Receipts</Text>
          {receiptDocs.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No receipt uploaded yet</Text>
          ) : receiptDocs.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => Linking.openURL(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < receiptDocs.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
            >
              <Ionicons name="image-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{doc.file_name ?? 'Receipt'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </Card>

        {canUploadReceipt ? (
          <Button label="Upload Receipt" loading={uploadDocument.isPending} onPress={pickReceipt} />
        ) : (
          <AlertBox type="info" message="This payment is already confirmed." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
