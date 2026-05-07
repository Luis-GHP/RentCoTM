import { View, Text, ScrollView, TouchableOpacity, Linking, Image, Modal, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { AlertBox } from '../../../components/shared/AlertBox';
import { AppModal } from '../../../components/shared/AppModal';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { Avatar } from '../../../components/shared/Avatar';
import { useDocumentsForEntity } from '../../../lib/query/documents';
import { usePayment, useConfirmPayment, useMarkPaymentUnpaid } from '../../../lib/query/payments';
import { formatPHP, formatDate, getMonthName } from '../../../lib/format';
import { supabase } from '../../../lib/supabase';
import { daysPastPeriodEnd } from '../../../lib/domain/periods';

const PRIMARY = '#2F4A7D';
type PaymentAction = 'confirm' | 'revert';

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  gcash:  'GCash',
  maya:   'Maya',
  bank:   'Bank Transfer',
  cash:   'Cash',
  advance: 'Advance',
};

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: payment, isLoading } = usePayment(id);
  const { data: documents, refetch: refetchDocuments } = useDocumentsForEntity('rent_payment', id);
  const confirmPayment = useConfirmPayment();
  const markUnpaid = useMarkPaymentUnpaid();
  const [busy, setBusy] = useState(false);
  const [generatingOr, setGeneratingOr] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PaymentAction | null>(null);
  const [actionError, setActionError] = useState('');

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!payment) return null;

  const currentPayment = payment;
  const tenants = payment.lease?.lease_tenant ?? [];
  const primary = tenants.find(lt => lt.role === 'primary') ?? tenants[0];
  const tenantName = primary?.tenant?.name ?? 'Unknown';
  const tenantId = primary?.tenant?.id;
  const unitNumber = payment.lease?.unit?.unit_number ?? '—';
  const propertyName = payment.lease?.unit?.property?.name ?? '';
  const period = `${getMonthName(payment.period_month)} ${payment.period_year}`;
  const isPaid = payment.status === 'paid';
  const canConfirm = ['pending', 'overdue', 'partial', 'unpaid'].includes(payment.status) && !payment.or_number;
  const receiptDocs = (documents ?? []).filter(doc => doc.doc_type === 'receipt');
  const orDocs = (documents ?? []).filter(doc => doc.doc_type === 'or_pdf');
  const amountDue = Number(payment.amount_due);
  const amountPaid = Number(payment.amount_paid);
  const remainingBalance = Math.max(0, amountDue - amountPaid);
  const amountLabel = isPaid ? 'Amount Paid' : payment.status === 'partial' ? 'Partial Payment' : 'Amount Due';
  const overdueDays = ['paid', 'waived'].includes(payment.status)
    ? 0
    : daysPastPeriodEnd(payment.period_month, payment.period_year);
  const paymentStatus = overdueDays > 0 ? 'overdue' : payment.status;

  async function handleConfirm() {
    setActionError('');
    setConfirmAction('confirm');
  }

  async function handleMarkUnpaid() {
    setActionError('');
    setConfirmAction('revert');
  }

  async function runPaymentAction() {
    if (!confirmAction) return;
    setBusy(true);
    setActionError('');
    try {
      if (confirmAction === 'confirm') {
        await confirmPayment.mutateAsync({ paymentId: currentPayment.id, currentPaymentDate: currentPayment.payment_date });
      } else {
        await markUnpaid.mutateAsync({ paymentId: currentPayment.id, orNumber: currentPayment.or_number });
      }
      setConfirmAction(null);
    } catch {
      setActionError(confirmAction === 'confirm'
        ? 'Could not confirm payment. Please try again.'
        : 'Could not revert payment. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function ensureOrPdfUrl() {
    const existing = orDocs[0]?.file_url;
    if (existing) return existing;

    setGeneratingOr(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-or-pdf', {
        body: { payment_id: currentPayment.id },
      });
      if (error || data?.error || !data?.url) throw new Error(data?.error ?? error?.message ?? 'Could not generate OR.');
      await refetchDocuments();
      return data.url as string;
    } finally {
      setGeneratingOr(false);
    }
  }

  async function handleOpenOrPdf() {
    try {
      const url = await ensureOrPdfUrl();
      await Linking.openURL(url);
    } catch {
      setActionError('Could not open the Official Receipt PDF right now.');
    }
  }

  async function handleShareOrPdf() {
    try {
      const url = await ensureOrPdfUrl();
      await Share.share({
        title: currentPayment.or_number ?? 'Official Receipt',
        message: `${currentPayment.or_number ?? 'Official Receipt'}\n${url}`,
        url,
      });
    } catch {
      setActionError('Could not share the Official Receipt PDF right now.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{period}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            Unit {unitNumber}{propertyName ? ` · ${propertyName}` : ''}
          </Text>
        </View>
        <StatusBadge status={paymentStatus} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {actionError ? <AlertBox type="error" message={actionError} /> : null}

        {/* Amount hero */}
        <View style={{ backgroundColor: isPaid ? '#EAF7EF' : '#FFFBEB', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: isPaid ? '#BDE7CB' : '#FDE68A' }}>
          <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{amountLabel}</Text>
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#111827' }}>{formatPHP(isPaid ? amountPaid : amountDue)}</Text>
          {payment.status === 'partial' && (
            <Text style={{ fontSize: 13, color: '#B45309', marginTop: 4 }}>
              {formatPHP(amountPaid)} paid - {formatPHP(remainingBalance)} remaining
            </Text>
          )}
          {!isPaid && payment.status !== 'partial' && amountPaid > 0 ? (
            <Text style={{ fontSize: 13, color: '#B45309', marginTop: 4 }}>
              {formatPHP(amountPaid)} received - {formatPHP(remainingBalance)} remaining
            </Text>
          ) : null}
          {isPaid && payment.or_number && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={14} color="#14804A" />
              <Text style={{ fontSize: 13, color: '#14804A', fontWeight: '600' }}>{payment.or_number}</Text>
            </View>
          )}
        </View>

        {overdueDays > 0 ? (
          <AlertBox
            type="warning"
            message={`${period} rent is ${overdueDays} day${overdueDays === 1 ? '' : 's'} past the end of its billing month.`}
          />
        ) : null}

        {/* Tenant */}
        <TouchableOpacity
          disabled={!tenantId}
          activeOpacity={0.75}
          onPress={() => tenantId && router.push(`/(landlord)/tenants/${tenantId}`)}
        >
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={tenantName} size={44} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{tenantName}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Unit {unitNumber}</Text>
              </View>
              {tenantId ? <Ionicons name="chevron-forward" size={18} color="#9CA3AF" /> : null}
            </View>
          </Card>
        </TouchableOpacity>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Tenant Receipts</Text>
          {receiptDocs.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No tenant receipt uploaded yet</Text>
          ) : receiptDocs.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => setSelectedReceiptUrl(doc.file_url)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < receiptDocs.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
            >
              <Image source={{ uri: doc.file_url }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: '#E4E0DC', marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{doc.file_name ?? 'Receipt'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Uploaded {formatDate(doc.uploaded_at)}</Text>
              </View>
              <Ionicons name="expand-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </Card>

        {payment.or_number ? (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Official Receipt</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF7EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="receipt-outline" size={20} color="#14804A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{payment.or_number}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {orDocs[0] ? 'PDF generated and attached' : 'PDF will be generated when opened or shared'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleOpenOrPdf}
                disabled={generatingOr}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BDE7CB', opacity: generatingOr ? 0.6 : 1 }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#14804A', fontSize: 13, fontWeight: '800' }}>{generatingOr ? 'Preparing...' : 'Open PDF'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShareOrPdf}
                disabled={generatingOr}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#14804A', opacity: generatingOr ? 0.6 : 1 }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Share PDF</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {/* Payment details */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Payment Details</Text>
          <ListRow label="Period"    value={period} showDivider />
          <ListRow label="Method"    value={payment.payment_method ? PAYMENT_METHOD_LABEL[payment.payment_method] ?? payment.payment_method : '—'} showDivider />
          {payment.reference_number && (
            <ListRow label="Reference" value={payment.reference_number} showDivider />
          )}
          <ListRow label="Date"      value={formatDate(payment.payment_date)} showDivider={isPaid} />
          {isPaid && (
            <ListRow label="Confirmed" value={formatDate(payment.confirmed_at)} showDivider={false} />
          )}
        </Card>

        {/* Action */}
        {canConfirm && (
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={busy}
            style={{ backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10, opacity: busy ? 0.6 : 1 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {busy ? 'Processing…' : 'Confirm Payment & Issue OR'}
            </Text>
          </TouchableOpacity>
        )}

        {payment.or_number && (
          <TouchableOpacity
            onPress={handleMarkUnpaid}
            disabled={busy}
            style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E4E0DC', opacity: busy ? 0.6 : 1 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Void OR & Mark Pending</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      <AppModal
        visible={!!confirmAction}
        tone={confirmAction === 'revert' ? 'danger' : 'info'}
        title={confirmAction === 'revert' ? 'Void Official Receipt?' : 'Confirm Payment?'}
        message={confirmAction === 'revert'
          ? 'This will void the issued OR and revert the payment to pending.'
          : `Mark ${period} payment from ${tenantName} as confirmed? An Official Receipt will be issued.`}
        cancelLabel="Cancel"
        confirmLabel={confirmAction === 'revert' ? 'Void OR' : 'Confirm'}
        confirmVariant={confirmAction === 'revert' ? 'danger' : 'primary'}
        loading={busy}
        onCancel={() => !busy && setConfirmAction(null)}
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
          {selectedReceiptUrl ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(selectedReceiptUrl)}
              activeOpacity={0.8}
              style={{ alignSelf: 'center', marginTop: 16, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Open Original</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
