import { View, Text, TouchableOpacity, ScrollView, Linking, TextInput, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
import { Button } from '../../../components/shared/Button';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useDocumentsForEntity } from '../../../lib/query/documents';
import { useConfirmUtilityBill, useMarkUtilityBillPaid, useMarkUtilityBillUnpaid, useUpdateUtilityBill, useUtilityBill } from '../../../lib/query/utilities';
import { formatDate, formatPHP, getMonthName } from '../../../lib/format';
import { isDocumentImage, isUtilityBillDocumentType } from '../../../lib/domain/documents';

const PRIMARY = '#2F4A7D';

const UTILITY_TYPES = ['electric', 'water', 'internet', 'other'] as const;

export default function UtilityBillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: bill, isLoading, error } = useUtilityBill(id);
  const { data: documents } = useDocumentsForEntity('utility_bill', id);
  const confirmBill = useConfirmUtilityBill();
  const markPaid = useMarkUtilityBillPaid();
  const markUnpaid = useMarkUtilityBillUnpaid();
  const updateBill = useUpdateUtilityBill();
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState('');
  const [utilityType, setUtilityType] = useState('electric');
  const [periodMonth, setPeriodMonth] = useState('');
  const [periodYear, setPeriodYear] = useState('');
  const [kwhConsumed, setKwhConsumed] = useState('');
  const [ratePerKwh, setRatePerKwh] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentAction, setPaymentAction] = useState<'paid' | 'unpaid' | null>(null);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bill) return;
    setProvider(bill.provider);
    setUtilityType(bill.utility_type);
    setPeriodMonth(String(bill.period_month));
    setPeriodYear(String(bill.period_year));
    setKwhConsumed(bill.kwh_consumed == null ? '' : String(bill.kwh_consumed));
    setRatePerKwh(bill.rate_per_kwh == null ? '' : String(bill.rate_per_kwh));
    setAmount(String(bill.amount));
  }, [bill]);

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
  const billDocs = (documents ?? []).filter(doc => isUtilityBillDocumentType(doc.doc_type));
  const billFiles = billDocs.length > 0
    ? billDocs
    : currentBill.bill_pdf_url
      ? [{
        id: 'bill-pdf-url',
        file_url: currentBill.bill_pdf_url,
        file_name: 'Original Bill',
        uploaded_by: currentBill.uploaded_by,
        uploaded_at: currentBill.created_at,
      }]
      : [];
  const receiptDocs = (documents ?? []).filter(doc => doc.doc_type === 'receipt');
  const unitLabel = `Unit ${currentBill.unit?.unit_number ?? '-'}${currentBill.unit?.property?.name ? ` - ${currentBill.unit.property.name}` : ''}`;
  const isConfirmed = !!currentBill.confirmed_at;
  const isPaid = currentBill.status === 'paid';
  const isPaymentSubmitted = currentBill.status === 'payment_submitted';

  function confirm() {
    setFormError('');
    setConfirmOpen(true);
  }

  async function runConfirm() {
    try {
      await confirmBill.mutateAsync(currentBill.id);
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
      setFormError('Could not confirm this bill.');
    }
  }

  async function runPaymentAction() {
    if (!paymentAction) return;
    setFormError('');
    try {
      if (paymentAction === 'paid') {
        await markPaid.mutateAsync(currentBill.id);
      } else {
        await markUnpaid.mutateAsync(currentBill.id);
      }
      setPaymentAction(null);
    } catch {
      setPaymentAction(null);
      setFormError(paymentAction === 'paid' ? 'Could not mark this bill paid.' : 'Could not mark this bill unpaid.');
    }
  }

  async function saveEdits() {
    setFormError('');
    const month = Number(periodMonth);
    const year = Number(periodYear);
    const total = Number(amount);
    if (!provider.trim()) { setFormError('Provider is required.'); return; }
    if (!month || month < 1 || month > 12) { setFormError('Period month must be 1 to 12.'); return; }
    if (!year || year < 2000) { setFormError('Enter a valid period year.'); return; }
    if (!total || total <= 0) { setFormError('Enter a valid amount.'); return; }

    try {
      await updateBill.mutateAsync({
        id: currentBill.id,
        provider: provider.trim(),
        utilityType,
        periodMonth: month,
        periodYear: year,
        kwhConsumed: kwhConsumed ? Number(kwhConsumed) : null,
        ratePerKwh: ratePerKwh ? Number(ratePerKwh) : null,
        amount: total,
      });
      setEditing(false);
    } catch {
      setFormError('Could not update this bill.');
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
        <StatusBadge status={isConfirmed ? currentBill.status : 'pending'} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {bill.uploaded_by === 'tenant' && !isConfirmed ? (
          <AlertBox type="warning" message="Uploaded by tenant. Pending your review." />
        ) : null}
        {formError ? <AlertBox type="error" message={formError} /> : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' }}>Bill Info</Text>
            {!isConfirmed && (
              <TouchableOpacity onPress={() => setEditing(value => !value)} activeOpacity={0.7}>
                <Ionicons name={editing ? 'close-outline' : 'pencil-outline'} size={22} color={PRIMARY} />
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                {UTILITY_TYPES.map(type => (
                  <TouchableOpacity key={type} onPress={() => setUtilityType(type)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: utilityType === type ? PRIMARY : '#F1EFEC' }} activeOpacity={0.75}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: utilityType === type ? '#fff' : '#6B7280', textTransform: 'capitalize' }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput value={provider} onChangeText={setProvider} placeholder="Provider" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput value={periodMonth} onChangeText={setPeriodMonth} placeholder="Month" keyboardType="number-pad" placeholderTextColor="#9CA3AF" style={{ flex: 1, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
                <TextInput value={periodYear} onChangeText={setPeriodYear} placeholder="Year" keyboardType="number-pad" placeholderTextColor="#9CA3AF" style={{ flex: 1, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              </View>
              <TextInput value={kwhConsumed} onChangeText={setKwhConsumed} placeholder="kWh consumed" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              <TextInput value={ratePerKwh} onChangeText={setRatePerKwh} placeholder="Rate per kWh" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 10, color: '#111827' }} />
              <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" style={{ backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', borderRadius: 10, height: 46, paddingHorizontal: 12, marginBottom: 12, color: '#111827' }} />
              <Button label="Save Changes" loading={updateBill.isPending} onPress={saveEdits} />
            </>
          ) : (
            <>
              <ListRow label="Type" value={bill.utility_type.replace('_', ' ')} showDivider />
              <ListRow label="Provider" value={bill.provider} showDivider />
              <ListRow label="Period" value={`${getMonthName(bill.period_month)} ${bill.period_year}`} showDivider />
              <ListRow label="kWh Consumed" value={bill.kwh_consumed == null ? 'Not set' : `${bill.kwh_consumed} kWh`} showDivider />
              <ListRow label="Rate per kWh" value={bill.rate_per_kwh == null ? 'Not set' : formatPHP(bill.rate_per_kwh)} showDivider />
              <ListRow label="Amount" value={formatPHP(bill.amount)} showDivider={false} />
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Source</Text>
          <ListRow label="Uploaded By" value={bill.uploaded_by === 'tenant' ? 'Tenant' : 'Landlord'} showDivider />
          {billFiles.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => Linking.openURL(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < billFiles.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: '#374151' }}>{doc.file_name ?? 'Uploaded bill PDF'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Uploaded by {doc.uploaded_by}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
          {billFiles.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF', paddingTop: 12 }}>No PDF uploaded</Text>
          ) : null}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Payment Status</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {isPaid
                  ? 'Tenant utility payment is marked paid.'
                  : isPaymentSubmitted
                    ? 'Tenant submitted a receipt for your verification.'
                    : 'Waiting for payment or landlord confirmation.'}
              </Text>
            </View>
            <StatusBadge status={currentBill.status} />
          </View>
          {isPaymentSubmitted ? (
            <AlertBox type="warning" message="Verify the receipt against your utility account or manual records before marking this bill paid." />
          ) : null}
          {!isConfirmed ? (
            <AlertBox type="info" message="Confirm the bill amount before marking payment status." />
          ) : isPaid ? (
            <Button
              label="Mark Unpaid"
              variant="secondary"
              loading={markUnpaid.isPending}
              onPress={() => setPaymentAction('unpaid')}
            />
          ) : isPaymentSubmitted ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label="Keep Unpaid"
                variant="secondary"
                loading={markUnpaid.isPending}
                disabled={markPaid.isPending}
                onPress={() => setPaymentAction('unpaid')}
                style={{ flex: 1 }}
              />
              <Button
                label="Mark Paid"
                loading={markPaid.isPending}
                disabled={markUnpaid.isPending}
                onPress={() => setPaymentAction('paid')}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <Button
              label="Mark Paid"
              loading={markPaid.isPending}
              onPress={() => setPaymentAction('paid')}
            />
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Tenant Receipts</Text>
          {receiptDocs.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No utility payment receipt uploaded yet</Text>
          ) : receiptDocs.map((doc, index) => {
            const image = isDocumentImage(doc);
            return (
              <TouchableOpacity
                key={doc.id}
                onPress={() => image ? setSelectedReceiptUrl(doc.file_url) : Linking.openURL(doc.file_url)}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < receiptDocs.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
              >
                {image ? (
                  <Image source={{ uri: doc.file_url }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: '#E4E0DC', marginRight: 12 }} />
                ) : (
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF7EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="receipt-outline" size={19} color="#14804A" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Utility receipt'}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Uploaded {formatDate(doc.uploaded_at)}</Text>
                </View>
                <Ionicons name={image ? 'expand-outline' : 'open-outline'} size={16} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })}
        </Card>

        {isConfirmed ? (
          <Card>
            <ListRow label="Confirmed By" value="Landlord" showDivider />
            <ListRow label="Confirmed At" value={formatDate(bill.confirmed_at)} showDivider={false} />
          </Card>
        ) : (
          <Button label="Confirm Bill" loading={confirmBill.isPending} onPress={confirm} />
        )}
      </ScrollView>

      <AppModal
        visible={confirmOpen}
        tone="info"
        title="Confirm Bill?"
        message="Confirm this utility bill? Tenant-uploaded bills will be marked as reviewed."
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        loading={confirmBill.isPending}
        onCancel={() => !confirmBill.isPending && setConfirmOpen(false)}
        onConfirm={runConfirm}
      />
      <AppModal
        visible={!!paymentAction}
        tone={paymentAction === 'paid' ? 'success' : 'warning'}
        title={paymentAction === 'paid' ? 'Mark Utility Paid?' : 'Mark Utility Unpaid?'}
        message={paymentAction === 'paid'
          ? 'This will mark the utility bill as paid for the tenant.'
          : 'This will move the utility bill back to unpaid.'}
        cancelLabel="Cancel"
        confirmLabel={paymentAction === 'paid' ? 'Mark Paid' : 'Mark Unpaid'}
        loading={markPaid.isPending || markUnpaid.isPending}
        onCancel={() => !(markPaid.isPending || markUnpaid.isPending) && setPaymentAction(null)}
        onConfirm={runPaymentAction}
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
