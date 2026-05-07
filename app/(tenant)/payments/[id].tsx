import { View, Text, TouchableOpacity, ScrollView, Linking, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { DocumentRow, useDeleteDocument, useDocumentsForEntity, useUploadDocument } from '../../../lib/query/documents';
import { useTenantPayment } from '../../../lib/query/tenant-home';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';
import { notifyLandlordsForPayment } from '../../../lib/notifications';
import { isFuturePeriod } from '../../../lib/domain/periods';
import { isDocumentImage } from '../../../lib/domain/documents';

const PRIMARY = '#2F4A7D';

export default function TenantPaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: payment, isLoading, error } = useTenantPayment(id);
  const { data: documents } = useDocumentsForEntity('rent_payment', id);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [localReceiptDocs, setLocalReceiptDocs] = useState<DocumentRow[]>([]);
  const [removeReceiptTarget, setRemoveReceiptTarget] = useState<DocumentRow | null>(null);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !payment) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load payment right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentPayment = payment;
  const serverReceiptDocs = (documents ?? []).filter(doc => doc.doc_type === 'receipt');
  const receiptDocs = [
    ...localReceiptDocs,
    ...serverReceiptDocs.filter(doc => !localReceiptDocs.some(localDoc => localDoc.id === doc.id)),
  ];
  const canUploadReceipt = ['pending', 'unpaid', 'overdue'].includes(currentPayment.status);
  const isAttachmentBusy = uploadDocument.isPending || deleteDocument.isPending;
  const advance = isFuturePeriod(currentPayment.period_month, currentPayment.period_year);
  const unitLabel = currentPayment.lease?.unit
    ? `Unit ${currentPayment.lease.unit.unit_number}${currentPayment.lease.unit.property?.name ? ` - ${currentPayment.lease.unit.property.name}` : ''}`
    : 'Unit not set';

  async function pickReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadMessage('');
      setUploadError('Allow photo access to upload a receipt screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadMessage('');
    setUploadError('');
    try {
      const existingReceipts = receiptDocs;
      const uploadedReceipt = await uploadDocument.mutateAsync({
        entityType: 'rent_payment',
        entityId: currentPayment.id,
        docType: 'receipt',
        uri: asset.uri,
        fileName: asset.fileName ?? `receipt-${Date.now()}.jpg`,
        contentType: asset.mimeType,
        uploadedBy: 'tenant',
      });
      setLocalReceiptDocs([uploadedReceipt]);
      void notifyLandlordsForPayment(currentPayment.id, {
        title: 'Receipt uploaded',
        body: `${getMonthName(currentPayment.period_month)} ${currentPayment.period_year} rent receipt is ready for review.`,
        data: { type: 'receipt_uploaded', route: `/(landlord)/payments/${currentPayment.id}`, payment_id: currentPayment.id },
      });
      let failedCleanup = false;
      for (const doc of existingReceipts.filter(doc => doc.id !== uploadedReceipt.id)) {
        try {
          await deleteDocument.mutateAsync(doc);
        } catch (error) {
          failedCleanup = true;
          console.warn('Could not remove previous rent receipt', error);
        }
      }
      setUploadMessage(failedCleanup
        ? 'New receipt uploaded. The older receipt could not be removed yet.'
        : 'Receipt uploaded. Your landlord can now review it.');
    } catch {
      setUploadError('Could not upload this receipt right now.');
    }
  }

  async function removeReceipt() {
    if (!removeReceiptTarget) return;
    setUploadMessage('');
    setUploadError('');
    try {
      await deleteDocument.mutateAsync(removeReceiptTarget);
      setLocalReceiptDocs(current => current.filter(doc => doc.id !== removeReceiptTarget.id));
      setRemoveReceiptTarget(null);
      setUploadMessage('Receipt removed.');
    } catch {
      setUploadError('Could not remove this receipt right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
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
        {uploadMessage ? <AlertBox type="success" message={uploadMessage} /> : null}
        {uploadError ? <AlertBox type="error" message={uploadError} /> : null}

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
          ) : receiptDocs.map((doc, index) => {
            const image = isDocumentImage(doc);
            return (
              <View
                key={doc.id}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < receiptDocs.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
              >
                <TouchableOpacity
                  onPress={() => image ? setSelectedReceiptUrl(doc.file_url) : Linking.openURL(doc.file_url)}
                  activeOpacity={0.75}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                >
                  {image ? (
                    <Image source={{ uri: doc.file_url }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#E4E0DC', marginRight: 12 }} />
                  ) : (
                    <Ionicons name="image-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Receipt'}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
                  </View>
                  <Ionicons name={image ? 'expand-outline' : 'open-outline'} size={16} color="#9CA3AF" />
                </TouchableOpacity>
                {canUploadReceipt ? (
                  <TouchableOpacity
                    onPress={() => setRemoveReceiptTarget(doc)}
                    activeOpacity={0.75}
                    disabled={isAttachmentBusy}
                    style={{ marginLeft: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', opacity: isAttachmentBusy ? 0.55 : 1 }}
                  >
                    <Ionicons name="trash-outline" size={17} color="#DC2626" />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </Card>

        {canUploadReceipt ? (
          <Button label={receiptDocs.length > 0 ? 'Replace Receipt' : 'Upload Receipt'} loading={isAttachmentBusy} onPress={pickReceipt} />
        ) : (
          <AlertBox type="info" message="This payment is already confirmed." />
        )}
      </ScrollView>
      <AppModal
        visible={!!removeReceiptTarget}
        tone="danger"
        title="Remove Receipt?"
        message="This removes the uploaded receipt from this payment. You can upload another one while the payment is still pending."
        cancelLabel="Cancel"
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={deleteDocument.isPending}
        onCancel={() => !deleteDocument.isPending && setRemoveReceiptTarget(null)}
        onConfirm={removeReceipt}
      />
      <Modal visible={!!selectedReceiptUrl} transparent animationType="fade" onRequestClose={() => setSelectedReceiptUrl(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.92)', padding: 16, justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedReceiptUrl(null)}
            activeOpacity={0.8}
            style={{ position: 'absolute', top: 54, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {selectedReceiptUrl ? (
            <Image source={{ uri: selectedReceiptUrl }} resizeMode="contain" style={{ width: '100%', height: '82%' }} />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
