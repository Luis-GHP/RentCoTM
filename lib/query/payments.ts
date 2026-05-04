import { useQuery } from '@tanstack/react-query';
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
