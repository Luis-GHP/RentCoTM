import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

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
      return data as PaymentRow[];
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
      return data as PaymentDetail;
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, currentPaymentDate }: { paymentId: string; currentPaymentDate?: string | null }) => {
      const { data: orNumber, error: orErr } = await supabase
        .rpc('claim_or_number', { p_payment_id: paymentId });
      if (orErr) throw orErr;

      const update: Record<string, unknown> = {
        status: 'paid',
        or_number: orNumber,
        confirmed_by: 'landlord',
        confirmed_at: new Date().toISOString(),
      };
      // Only set payment_date if none was recorded — preserve the date the landlord entered
      if (!currentPaymentDate) {
        update.payment_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('rent_payment')
        .update(update)
        .eq('id', paymentId);

      if (error) {
        await supabase.rpc('void_or_number', { p_or_number: orNumber });
        throw error;
      }
    },
    onSuccess: (_data, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
    },
  });
}

export function useMarkPaymentUnpaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, orNumber }: { paymentId: string; orNumber: string | null }) => {
      if (orNumber) {
        await supabase.rpc('void_or_number', { p_or_number: orNumber });
      }
      const { error } = await supabase
        .from('rent_payment')
        .update({ status: 'pending', or_number: null, confirmed_by: null, confirmed_at: null })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: (_data, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
    },
  });
}

export type ActiveLease = {
  id: string;
  monthly_rent: number;
  unit: { id: string; unit_number: string; property: { name: string } | null } | null;
  lease_tenant: { role: string; tenant: { name: string } | null }[];
};

export function useActiveLeases() {
  return useQuery({
    queryKey: ['active-leases'],
    queryFn: async (): Promise<ActiveLease[]> => {
      const { data, error } = await supabase
        .from('lease')
        .select(`
          id, monthly_rent,
          unit:unit_id (id, unit_number, property:property_id (name)),
          lease_tenant (role, tenant:tenant_id (name))
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActiveLease[];
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

      // Insert the payment record
      const { data: inserted, error: insertErr } = await supabase
        .from('rent_payment')
        .insert({
          lease_id: params.leaseId,
          period_month: params.periodMonth,
          period_year: params.periodYear,
          amount_due: params.amountDue,
          amount_paid: params.amountPaid,
          payment_method: params.paymentMethod,
          reference_number: params.referenceNumber || null,
          payment_date: params.paymentDate,
          status: isPaid ? 'paid' : 'partial',
          confirmed_by: 'landlord',
          confirmed_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Claim OR number for full payments
      if (isPaid) {
        const { data: orNumber, error: orErr } = await supabase
          .rpc('claim_or_number', { p_payment_id: inserted.id });
        if (orErr) throw orErr;

        const { error: updateErr } = await supabase
          .from('rent_payment')
          .update({ or_number: orNumber })
          .eq('id', inserted.id);
        if (updateErr) {
          await supabase.rpc('void_or_number', { p_or_number: orNumber });
          throw updateErr;
        }
      }

      return inserted.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['active-leases'] });
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
