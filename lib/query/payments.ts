import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { notifyTenantsForLease, paymentNotificationBody } from '../notifications';
import { comparePeriods, currentPeriod, isPastPeriod, periodFromDate, Period } from '../domain/periods';

export type PaymentRow = {
  id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  status: string;
  or_number: string | null;
  confirmed_at: string | null;
  lease: {
    unit: { unit_number: string } | null;
    lease_tenant: { role: string; tenant: { name: string } | null }[];
  } | null;
};

export function useAllPayments() {
  return useQuery({
    queryKey: ['all-payments'],
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select(`
          id, period_month, period_year, amount_due, amount_paid,
          payment_date, payment_method, reference_number, status, or_number, confirmed_at,
          lease:lease_id (
            unit:unit_id (unit_number),
            lease_tenant (role, tenant:tenant_id (name))
          )
        `)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data as unknown as PaymentRow[];
    },
  });
}

export type PaymentDetail = {
  id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  status: string;
  or_number: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  lease: {
    id: string;
    monthly_rent: number;
    unit: { unit_number: string; property: { name: string } | null } | null;
    lease_tenant: { role: string; tenant: { id: string; name: string } | null }[];
  } | null;
};

export function usePayment(id?: string) {
  return useQuery({
    queryKey: ['payment', id],
    enabled: !!id,
    queryFn: async (): Promise<PaymentDetail> => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select(`
          id, period_month, period_year, amount_due, amount_paid,
          payment_date, payment_method, reference_number, status,
          or_number, confirmed_at, confirmed_by, created_at,
          lease:lease_id (
            id, monthly_rent,
            unit:unit_id (unit_number, property:property_id (name)),
            lease_tenant (role, tenant:tenant_id (id, name))
          )
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as PaymentDetail;
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, currentPaymentDate }: { paymentId: string; currentPaymentDate?: string | null }) => {
      const { data: payment, error: paymentErr } = await supabase
        .from('rent_payment')
        .select('lease_id, period_month, period_year')
        .eq('id', paymentId)
        .single();
      if (paymentErr) throw paymentErr;

      const { error } = await supabase.rpc('confirm_rent_payment', {
        p_payment_id: paymentId,
        p_current_payment_date: currentPaymentDate ?? null,
      });
      if (error) throw error;

      const period = paymentNotificationBody(payment.period_month, payment.period_year);
      void notifyTenantsForLease(payment.lease_id, {
        title: 'Payment confirmed',
        body: `${period} rent payment has been confirmed.`,
        data: { type: 'payment_confirmed', route: `/(tenant)/payments/${paymentId}`, payment_id: paymentId },
      });
    },
    onSuccess: (_data, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['property-income-summary'] });
      queryClient.invalidateQueries({ queryKey: ['unit-payment-history'] });
    },
  });
}

export function useMarkPaymentUnpaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId }: { paymentId: string; orNumber: string | null }) => {
      const { data: payment, error: paymentErr } = await supabase
        .from('rent_payment')
        .select('lease_id, period_month, period_year')
        .eq('id', paymentId)
        .single();
      if (paymentErr) throw paymentErr;

      const { error } = await supabase.rpc('revert_rent_payment_to_pending', {
        p_payment_id: paymentId,
      });
      if (error) throw error;

      const period = paymentNotificationBody(payment.period_month, payment.period_year);
      void notifyTenantsForLease(payment.lease_id, {
        title: 'Payment status updated',
        body: `${period} rent payment was marked pending.`,
        data: { type: 'payment_pending', route: `/(tenant)/payments/${paymentId}`, payment_id: paymentId },
      });
    },
    onSuccess: (_data, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['property-income-summary'] });
      queryClient.invalidateQueries({ queryKey: ['unit-payment-history'] });
    },
  });
}

export type ActiveLease = {
  id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  unit: { id: string; unit_number: string; property: { name: string } | null } | null;
  lease_tenant: { role: string; tenant: { name: string } | null }[];
};

function leaseCoversPeriod(lease: Pick<ActiveLease, 'start_date' | 'end_date'>, period: Period) {
  const start = periodFromDate(lease.start_date);
  const end = periodFromDate(lease.end_date);
  return comparePeriods(start, period) <= 0 && comparePeriods(period, end) <= 0;
}

function paymentStatusForPeriod(month: number, year: number) {
  return isPastPeriod(month, year) ? 'overdue' : 'pending';
}

export function useActiveLeases() {
  return useQuery({
    queryKey: ['active-leases'],
    queryFn: async (): Promise<ActiveLease[]> => {
      const { data, error } = await supabase
        .from('lease')
        .select(`
          id, monthly_rent, start_date, end_date,
          unit:unit_id (id, unit_number, property:property_id (name)),
          lease_tenant (role, tenant:tenant_id (name))
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ActiveLease[];
    },
  });
}

export type ExistingRentPayment = {
  id: string;
  lease_id?: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  or_number: string | null;
  payment_date: string | null;
};

export function useExistingRentPayment(params: {
  leaseId?: string | null;
  periodMonth: number;
  periodYear: number;
}) {
  return useQuery({
    queryKey: ['rent-payment-period', params.leaseId, params.periodMonth, params.periodYear],
    enabled: !!params.leaseId,
    queryFn: async (): Promise<ExistingRentPayment | null> => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('id, status, amount_due, amount_paid, or_number, payment_date')
        .eq('lease_id', params.leaseId!)
        .eq('period_month', params.periodMonth)
        .eq('period_year', params.periodYear)
        .maybeSingle();
      if (error) throw error;
      return data as ExistingRentPayment | null;
    },
  });
}

export type RentCyclePreviewRow = {
  lease: ActiveLease;
  existingPayment: ExistingRentPayment | null;
  suggestedStatus: 'pending' | 'overdue';
};

export type RentCyclePreview = {
  periodMonth: number;
  periodYear: number;
  rows: RentCyclePreviewRow[];
  missingCount: number;
  existingCount: number;
  totalExpected: number;
  totalCollected: number;
};

export function primaryLeaseTenantName(lease: Pick<ActiveLease, 'lease_tenant'>) {
  const primary = lease.lease_tenant.find(lt => lt.role === 'primary') ?? lease.lease_tenant[0];
  return primary?.tenant?.name ?? 'Unknown';
}

export function unitLeaseLabel(lease: Pick<ActiveLease, 'unit'>) {
  const unit = lease.unit;
  if (!unit) return 'Unit not set';
  return `Unit ${unit.unit_number}${unit.property?.name ? ` - ${unit.property.name}` : ''}`;
}

export function useRentCyclePreview(params?: { periodMonth?: number; periodYear?: number }) {
  const fallback = currentPeriod();
  const periodMonth = params?.periodMonth ?? fallback.month;
  const periodYear = params?.periodYear ?? fallback.year;

  return useQuery({
    queryKey: ['rent-cycle-preview', periodMonth, periodYear],
    queryFn: async (): Promise<RentCyclePreview> => {
      const { data: leasesData, error: leasesError } = await supabase
        .from('lease')
        .select(`
          id, monthly_rent, start_date, end_date,
          unit:unit_id (id, unit_number, property:property_id (name)),
          lease_tenant (role, tenant:tenant_id (name))
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (leasesError) throw leasesError;

      const period = { month: periodMonth, year: periodYear };
      const leases = ((leasesData ?? []) as unknown as ActiveLease[]).filter(lease => leaseCoversPeriod(lease, period));
      const leaseIds = leases.map(lease => lease.id);

      let payments: ExistingRentPayment[] = [];
      if (leaseIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('rent_payment')
          .select('id, lease_id, status, amount_due, amount_paid, or_number, payment_date')
          .in('lease_id', leaseIds)
          .eq('period_month', periodMonth)
          .eq('period_year', periodYear);
        if (paymentsError) throw paymentsError;
        payments = (paymentsData ?? []) as ExistingRentPayment[];
      }

      const paymentByLeaseId = new Map(payments.map(payment => [payment.lease_id, payment]));
      const rows = leases.map(lease => ({
        lease,
        existingPayment: paymentByLeaseId.get(lease.id) ?? null,
        suggestedStatus: paymentStatusForPeriod(periodMonth, periodYear) as 'pending' | 'overdue',
      }));

      return {
        periodMonth,
        periodYear,
        rows,
        missingCount: rows.filter(row => !row.existingPayment).length,
        existingCount: rows.filter(row => !!row.existingPayment).length,
        totalExpected: rows.reduce((sum, row) => sum + Number(row.lease.monthly_rent), 0),
        totalCollected: rows.reduce((sum, row) => sum + Number(row.existingPayment?.amount_paid ?? 0), 0),
      };
    },
  });
}

export function useGenerateRentCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { periodMonth?: number; periodYear?: number }) => {
      const fallback = currentPeriod();
      const periodMonth = params?.periodMonth ?? fallback.month;
      const periodYear = params?.periodYear ?? fallback.year;

      const { data, error } = await supabase.rpc('generate_rent_cycle', {
        p_period_month: periodMonth,
        p_period_year: periodYear,
      });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      return {
        createdCount: result?.created_count ?? 0,
        skippedCount: result?.skipped_count ?? 0,
        periodMonth,
        periodYear,
      };
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['rent-cycle-preview', result.periodMonth, result.periodYear] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      queryClient.invalidateQueries({ queryKey: ['property-income-summary'] });
      queryClient.invalidateQueries({ queryKey: ['unit-current-rent-payment'] });
      queryClient.invalidateQueries({ queryKey: ['unit-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['current-rent'] });
      queryClient.invalidateQueries({ queryKey: ['all-tenant-payments'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      leaseId: string;
      periodMonth: number;
      periodYear: number;
      amountDue: number;
      amountPaid: number;
      paymentMethod: string;
      referenceNumber: string;
      paymentDate: string;
    }) => {
      const isPaid = params.amountPaid >= params.amountDue;
      const { data: paymentId, error } = await supabase.rpc('record_landlord_rent_payment', {
        p_lease_id: params.leaseId,
        p_period_month: params.periodMonth,
        p_period_year: params.periodYear,
        p_amount_due: params.amountDue,
        p_amount_paid: params.amountPaid,
        p_payment_method: params.paymentMethod,
        p_reference_number: params.referenceNumber,
        p_payment_date: params.paymentDate,
      });
      if (error) throw error;

      const id = paymentId as string;
      const period = paymentNotificationBody(params.periodMonth, params.periodYear);
      void notifyTenantsForLease(params.leaseId, {
        title: isPaid ? 'Payment recorded' : 'Partial payment recorded',
        body: `${period} rent payment has been recorded.`,
        data: { type: 'payment_recorded', route: `/(tenant)/payments/${id}`, payment_id: id },
      });

      return id;
    },
    onSuccess: paymentId => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['active-leases'] });
      queryClient.invalidateQueries({ queryKey: ['rent-payment-period'] });
      queryClient.invalidateQueries({ queryKey: ['property-income-summary'] });
      queryClient.invalidateQueries({ queryKey: ['unit-payment-history'] });
    },
  });
}

export function usePayments(leaseId?: string) {
  return useQuery({
    queryKey: ['payments', leaseId],
    queryFn: async () => {
      let query = supabase
        .from('rent_payment')
        .select('*')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (leaseId) query = query.eq('lease_id', leaseId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
