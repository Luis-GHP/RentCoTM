import { View, Text, TouchableOpacity, ScrollView, Linking, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AppModal } from '../../../components/shared/AppModal';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { PromptBanner } from '../../../components/shared/PromptBanner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { DocumentRow, useDeleteDocument, useDocumentsForEntity, useUploadDocument } from '../../../lib/query/documents';
import { useSubmitUtilityBillPaymentReview, useTenantUtilityBill } from '../../../lib/query/tenant-home';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';
import { notifyLandlordsForUtilityBill } from '../../../lib/notifications';
import { isDocumentImage, isUtilityBillDocumentType } from '../../../lib/domain/documents';
import { isFuturePeriod } from '../../../lib/domain/periods';

const PRIMARY = '#2F4A7D';

function receiptReviewErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';

  if (message.includes('took too long')) return message;
  if (message.includes('Upload a receipt')) return message;
  if (message.includes('not ready')) return 'This bill is not ready for payment review yet.';
  return 'Could not submit this receipt for review right now.';
}

export default function TenantUtilityBillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: bill, isLoading, error } = useTenantUtilityBill(id);
  const { data: documents } = useDocumentsForEntity('utility_bill', id);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const submitReview = useSubmitUtilityBillPaymentReview();
  const [billUploadMessage, setBillUploadMessage] = useState('');
  const [billUploadError, setBillUploadError] = useState('');
  const [receiptUploadMessage, setReceiptUploadMessage] = useState('');
  const [receiptUploadError, setReceiptUploadError] = useState('');
  const [localBillDocs, setLocalBillDocs] = useState<DocumentRow[]>([]);
  const [localReceiptDocs, setLocalReceiptDocs] = useState<DocumentRow[]>([]);
  const [removeTarget, setRemoveTarget] = useState<{ doc: DocumentRow; kind: 'bill' | 'receipt' } | null>(null);
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error || !bill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>{"Couldn't load utility bill right now"}</Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Pull down to try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentBill = bill;
  const serverBillDocs = (documents ?? []).filter(doc => isUtilityBillDocumentType(doc.doc_type));
  const billDocs = [
    ...localBillDocs,
    ...serverBillDocs.filter(doc => !localBillDocs.some(localDoc => localDoc.id === doc.id)),
  ];
  const billFiles = billDocs.length > 0
    ? billDocs
    : currentBill.bill_pdf_url
      ? [{
        id: 'bill-pdf-url',
        entity_type: 'utility_bill',
        entity_id: currentBill.id,
        doc_type: 'utility_bill_pdf' as const,
        file_url: currentBill.bill_pdf_url,
        file_name: 'Original Bill',
        sort_order: null,
        area_tag: null,
        caption: null,
        uploaded_by: currentBill.uploaded_by,
        uploaded_at: currentBill.created_at,
      }]
      : [];
  const serverReceiptDocs = (documents ?? []).filter(doc => doc.doc_type === 'receipt');
  const receiptDocs = [
    ...localReceiptDocs,
    ...serverReceiptDocs.filter(doc => !localReceiptDocs.some(localDoc => localDoc.id === doc.id)),
  ];
  const advance = isFuturePeriod(currentBill.period_month, currentBill.period_year);
  const isBillConfirmed = !!currentBill.confirmed_at;
  const isLandlordPostedBill = currentBill.uploaded_by === 'landlord';
  const isPaymentReady = isLandlordPostedBill || isBillConfirmed;
  const isWaitingForBillReview = !isPaymentReady;
  const visibleStatus = isPaymentReady ? currentBill.status : 'pending';
  const isPaid = currentBill.status === 'paid';
  const isReceiptSubmitted = currentBill.status === 'payment_submitted';
  const canShowReceiptActions = currentBill.status === 'unpaid';
  const canUseReceiptActions = canShowReceiptActions && isPaymentReady;
  const canRemoveReceipt = currentBill.status === 'unpaid';
  const canSubmitReceipt = canUseReceiptActions && receiptDocs.length > 0;
  const isAttachmentBusy = uploadDocument.isPending || deleteDocument.isPending;
  const isActionBusy = isAttachmentBusy || submitReview.isPending;
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
    setBillUploadMessage('');
    setBillUploadError('');
    try {
      const existingBillDocs = billDocs;
      const uploadedBill = await uploadDocument.mutateAsync({
        entityType: 'utility_bill',
        entityId: currentBill.id,
        docType: 'utility_bill_pdf',
        uri: asset.uri,
        fileName: asset.name,
        contentType: asset.mimeType ?? 'application/pdf',
        uploadedBy: 'tenant',
      });
      setLocalBillDocs([uploadedBill]);
      void notifyLandlordsForUtilityBill(currentBill.id, {
        title: 'Utility bill uploaded',
        body: `${getMonthName(currentBill.period_month)} ${currentBill.period_year} ${currentBill.utility_type} bill is ready for review.`,
        data: { type: 'utility_bill_uploaded', route: `/(landlord)/utilities/${currentBill.id}`, utility_bill_id: currentBill.id },
      });
      let failedCleanup = false;
      for (const doc of existingBillDocs.filter(doc => doc.id !== uploadedBill.id)) {
        try {
          await deleteDocument.mutateAsync(doc);
        } catch (error) {
          failedCleanup = true;
          console.warn('Could not remove previous utility bill PDF', error);
        }
      }
      setBillUploadMessage(failedCleanup
        ? 'New bill PDF uploaded. The older PDF could not be removed yet.'
        : 'Bill uploaded. Your landlord can review it.');
    } catch (error) {
      console.warn('Could not upload tenant utility PDF', error);
      setBillUploadError('Could not upload this PDF right now.');
    }
  }

  async function pickReceipt() {
    if (!isPaymentReady) {
      setReceiptUploadMessage('');
      setReceiptUploadError('This tenant-uploaded bill needs landlord review before payment receipts can be submitted.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setReceiptUploadMessage('');
      setReceiptUploadError('Allow photo access to upload a receipt screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setReceiptUploadMessage('');
    setReceiptUploadError('');
    try {
      const existingReceipts = receiptDocs;
      const uploadedReceipt = await uploadDocument.mutateAsync({
        entityType: 'utility_bill',
        entityId: currentBill.id,
        docType: 'receipt',
        uri: asset.uri,
        fileName: asset.fileName ?? `utility-receipt-${Date.now()}.jpg`,
        contentType: asset.mimeType,
        uploadedBy: 'tenant',
      });
      setLocalReceiptDocs([uploadedReceipt]);
      let failedCleanup = false;
      for (const doc of existingReceipts.filter(doc => doc.id !== uploadedReceipt.id)) {
        try {
          await deleteDocument.mutateAsync(doc);
        } catch (error) {
          failedCleanup = true;
          console.warn('Could not remove previous utility receipt', error);
        }
      }
      setReceiptUploadMessage(failedCleanup
        ? 'New receipt uploaded. The older receipt could not be removed yet.'
        : 'Receipt added. Submit it when you are ready for landlord review.');
    } catch (error) {
      console.warn('Could not upload tenant utility receipt', error);
      setReceiptUploadError('Could not upload this receipt right now.');
    }
  }

  async function removeSelectedDocument() {
    if (!removeTarget) return;
    if (removeTarget.kind === 'bill') {
      setBillUploadMessage('');
      setBillUploadError('');
    } else {
      setReceiptUploadMessage('');
      setReceiptUploadError('');
    }

    try {
      await deleteDocument.mutateAsync(removeTarget.doc);
      if (removeTarget.kind === 'bill') {
        setLocalBillDocs(current => current.filter(doc => doc.id !== removeTarget.doc.id));
        setBillUploadMessage('Bill PDF removed.');
      } else {
        setLocalReceiptDocs(current => current.filter(doc => doc.id !== removeTarget.doc.id));
        setReceiptUploadMessage('Receipt removed.');
      }
      setRemoveTarget(null);
    } catch {
      if (removeTarget.kind === 'bill') {
        setBillUploadError('Could not remove this bill PDF right now.');
      } else {
        setReceiptUploadError('Could not remove this receipt right now.');
      }
    }
  }

  async function submitReceiptForReview() {
    setReceiptUploadMessage('');
    setReceiptUploadError('');
    if (!isPaymentReady) {
      setSubmitReviewOpen(false);
      setReceiptUploadError('This tenant-uploaded bill needs landlord review before payment receipts can be submitted.');
      return;
    }
    if (receiptDocs.length === 0) {
      setSubmitReviewOpen(false);
      setReceiptUploadError('Upload a receipt before submitting it for review.');
      return;
    }

    try {
      await submitReview.mutateAsync(currentBill);
      setSubmitReviewOpen(false);
      setReceiptUploadMessage('Receipt submitted. Your landlord will verify the payment.');
    } catch (error) {
      console.warn('Could not submit utility receipt for review', error);
      setSubmitReviewOpen(false);
      setReceiptUploadError(receiptReviewErrorMessage(error));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Utility Bill</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unitLabel}</Text>
        </View>
        <StatusBadge status={visibleStatus} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {billUploadMessage ? <PromptBanner tone="success" message={billUploadMessage} /> : null}
        {billUploadError ? <PromptBanner tone="error" message={billUploadError} /> : null}

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
          <ListRow label="Bill Review" value={isPaymentReady ? 'Ready for payment' : 'Pending landlord review'} showDivider={false} />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Payment</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {isPaid
                  ? 'This utility bill is marked paid.'
                  : isReceiptSubmitted
                    ? 'Receipt submitted. Your landlord will verify the payment.'
                    : isWaitingForBillReview
                      ? 'This tenant-uploaded bill is waiting for landlord review.'
                    : 'Upload a receipt after paying your landlord.'}
              </Text>
            </View>
            <StatusBadge status={visibleStatus} />
          </View>
          {receiptDocs.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 14 }}>No payment receipt uploaded yet</Text>
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
                    <Ionicons name="receipt-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Utility receipt'}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
                  </View>
                  <Ionicons name={image ? 'expand-outline' : 'open-outline'} size={16} color="#9CA3AF" />
                </TouchableOpacity>
                {canRemoveReceipt ? (
                  <TouchableOpacity
                    onPress={() => setRemoveTarget({ doc, kind: 'receipt' })}
                    activeOpacity={0.75}
                    disabled={isActionBusy}
                    style={{ marginLeft: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', opacity: isActionBusy ? 0.55 : 1 }}
                  >
                    <Ionicons name="trash-outline" size={17} color="#DC2626" />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
          {isReceiptSubmitted ? (
            <PromptBanner
              tone="success"
              solid
              title="Receipt submitted"
              message="Your landlord will verify the payment."
              style={{ marginTop: receiptDocs.length === 0 ? 0 : 14 }}
            />
          ) : null}
          {isWaitingForBillReview ? (
            <PromptBanner
              tone="warning"
              title="Waiting for bill review"
              message={receiptDocs.length > 0
                ? 'Receipt saved, but this tenant-uploaded bill needs landlord review before payment submission.'
                : 'This tenant-uploaded bill needs landlord review before payment receipts can be submitted.'}
              style={{ marginTop: receiptDocs.length === 0 ? 0 : 14 }}
            />
          ) : null}
          {receiptUploadMessage ? <PromptBanner tone="success" message={receiptUploadMessage} style={{ marginTop: receiptDocs.length === 0 ? 0 : 14 }} /> : null}
          {receiptUploadError ? <PromptBanner tone="error" message={receiptUploadError} style={{ marginTop: receiptDocs.length === 0 ? 0 : 14 }} /> : null}
          {canShowReceiptActions ? (
            <>
              <Button
                label={receiptDocs.length > 0 ? 'Replace Payment Receipt' : 'Upload Payment Receipt'}
                variant={receiptDocs.length > 0 ? 'secondary' : 'primary'}
                loading={isAttachmentBusy}
                disabled={submitReview.isPending || !canUseReceiptActions}
                onPress={pickReceipt}
                style={{ marginTop: receiptDocs.length === 0 && !receiptUploadMessage && !receiptUploadError ? 0 : 14 }}
              />
              {receiptDocs.length > 0 ? (
                <Button
                  label="Submit Receipt for Review"
                  loading={submitReview.isPending}
                  disabled={isAttachmentBusy || !canSubmitReceipt}
                  onPress={() => setSubmitReviewOpen(true)}
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </>
          ) : isPaid ? (
            <PromptBanner tone="success" solid title="Payment complete" message="This utility bill is marked paid." />
          ) : null}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Bill Files</Text>
          {billFiles.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No PDF uploaded yet</Text>
          ) : billFiles.map((doc, index) => (
            <View
              key={doc.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < billFiles.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
            >
              <TouchableOpacity
                onPress={() => Linking.openURL(doc.file_url)}
                activeOpacity={0.75}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              >
                <Ionicons name="document-attach-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Bill PDF'}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{formatDate(doc.uploaded_at)}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {doc.id !== 'bill-pdf-url' && canRemoveReceipt ? (
                <TouchableOpacity
                  onPress={() => setRemoveTarget({ doc, kind: 'bill' })}
                  activeOpacity={0.75}
                  disabled={isActionBusy}
                  style={{ marginLeft: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', opacity: isActionBusy ? 0.55 : 1 }}
                >
                  <Ionicons name="trash-outline" size={17} color="#DC2626" />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </Card>

        {billFiles.length === 0 ? (
          <Button label="Upload Bill PDF" variant="secondary" loading={isAttachmentBusy} disabled={submitReview.isPending} onPress={pickPdf} />
        ) : null}
      </ScrollView>
      <AppModal
        visible={submitReviewOpen}
        tone="info"
        title="Submit Receipt?"
        message="This sends your payment receipt to your landlord for verification. After submitting, the receipt is locked until your landlord marks the bill paid or keeps it unpaid."
        cancelLabel="Cancel"
        confirmLabel="Submit"
        loading={submitReview.isPending}
        onCancel={() => !submitReview.isPending && setSubmitReviewOpen(false)}
        onConfirm={submitReceiptForReview}
      />
      <AppModal
        visible={!!removeTarget}
        tone="danger"
        title={removeTarget?.kind === 'bill' ? 'Remove Bill PDF?' : 'Remove Receipt?'}
        message={removeTarget?.kind === 'bill'
          ? 'This removes the uploaded bill PDF from this utility bill. You can upload another PDF after removing it.'
          : 'This removes the uploaded receipt from this utility bill. You can upload another receipt while it is still unpaid.'}
        cancelLabel="Cancel"
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={deleteDocument.isPending}
        onCancel={() => !deleteDocument.isPending && setRemoveTarget(null)}
        onConfirm={removeSelectedDocument}
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
