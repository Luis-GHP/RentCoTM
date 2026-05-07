import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { currentPeriod } from '../domain/periods';
import { paymentCollectionBuckets } from '../domain/payments';

export function useLandlordInfo() {
  return useQuery({
    queryKey: ['landlord-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landlord')
        .select('id, name, email, phone')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useMonthlySummary(month?: number, year?: number) {
  const period = currentPeriod();
  const m = month ?? period.month;
  const y = year ?? period.year;

  return useQuery({
    queryKey: ['monthly-summary', m, y],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('amount_due, amount_paid, status')
        .eq('period_month', m)
        .eq('period_year', y);
      if (error) throw error;

      return (data ?? []).reduce(
        (acc, p) => {
          const buckets = paymentCollectionBuckets(p);
          acc.collected += buckets.collected;
          acc.pending += buckets.pending;
          acc.overdue += buckets.overdue;
          return acc;
        },
        { collected: 0, pending: 0, overdue: 0 }
      );
    },
  });
}

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ['portfolio-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property')
        .select('id, unit(id, status)');
      if (error) throw error;

      const propertyCount = data.length;
      const unitCount = data.reduce((s, p) => s + ((p.unit as any[])?.length ?? 0), 0);
      const occupiedCount = data.reduce(
        (s, p) => s + ((p.unit as any[])?.filter((u: any) => u.status === 'occupied').length ?? 0),
        0
      );
      return { propertyCount, unitCount, occupiedCount };
    },
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const [overdue, expiring, pending] = await Promise.all([
        supabase.from('rent_payment').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
        supabase.from('lease').select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .gte('end_date', today)
          .lte('end_date', in30Days),
        supabase.from('rent_payment').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      return {
        overduePayments: overdue.count ?? 0,
        expiringLeases: expiring.count ?? 0,
        pendingConfirmations: pending.count ?? 0,
      };
    },
  });
}
