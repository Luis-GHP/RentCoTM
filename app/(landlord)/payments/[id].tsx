import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { Card } from '../../../components/shared/Card';
import { ListRow } from '../../../components/shared/ListRow';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { Avatar } from '../../../components/shared/Avatar';
import { usePayment, useConfirmPayment, useMarkPaymentUnpaid } from '../../../lib/query/payments';
import { formatPHP, formatDate, getMonthName } from '../../../lib/format';

const PRIMARY = '#1B3C34';

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
  const confirmPayment = useConfirmPayment();
  const markUnpaid = useMarkPaymentUnpaid();
  const [busy, setBusy] = useState(false);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!payment) return null;

  const tenants = payment.lease?.lease_tenant ?? [];
  const primary = tenants.find(lt => lt.role === 'primary') ?? tenants[0];
  const tenantName = primary?.tenant?.name ?? 'Unknown';
  const unitNumber = payment.lease?.unit?.unit_number ?? '—';
  const propertyName = payment.lease?.unit?.property?.name ?? '';
  const period = `${getMonthName(payment.period_month)} ${payment.period_year}`;
  const isPaid = payment.status === 'paid';
  const canConfirm = ['pending', 'overdue', 'partial', 'unpaid'].includes(payment.status);

  async function handleConfirm() {
    Alert.alert(
      'Confirm Payment',
      `Mark ${period} payment from ${tenantName} as confirmed? An Official Receipt will be issued.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            setBusy(true);
            try {
              await confirmPayment.mutateAsync(payment.id);
            } catch {
              Alert.alert('Error', 'Could not confirm payment. Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  async function handleMarkUnpaid() {
    Alert.alert(
      'Mark as Unpaid',
      'This will void the issued OR and revert the payment to pending. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await markUnpaid.mutateAsync({ paymentId: payment.id, orNumber: payment.or_number });
            } catch {
              Alert.alert('Error', 'Could not revert payment. Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{period}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            Unit {unitNumber}{propertyName ? ` · ${propertyName}` : ''}
          </Text>
        </View>
        <StatusBadge status={payment.status} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Amount hero */}
        <View style={{ backgroundColor: isPaid ? '#F0FDF4' : '#FFFBEB', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: isPaid ? '#BBF7D0' : '#FDE68A' }}>
          <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>Amount Due</Text>
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#111827' }}>{formatPHP(Number(payment.amount_due))}</Text>
          {payment.status === 'partial' && (
            <Text style={{ fontSize: 13, color: '#B45309', marginTop: 4 }}>
              {formatPHP(Number(payment.amount_paid))} paid · {formatPHP(Number(payment.amount_due) - Number(payment.amount_paid))} remaining
            </Text>
          )}
          {isPaid && payment.or_number && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={14} color="#15803D" />
              <Text style={{ fontSize: 13, color: '#15803D', fontWeight: '600' }}>{payment.or_number}</Text>
            </View>
          )}
        </View>

        {/* Tenant */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={tenantName} size={44} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{tenantName}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Unit {unitNumber}</Text>
            </View>
          </View>
        </Card>

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

        {isPaid && (
          <TouchableOpacity
            onPress={handleMarkUnpaid}
            disabled={busy}
            style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', opacity: busy ? 0.6 : 1 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Mark as Unpaid</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
