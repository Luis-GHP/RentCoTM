import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

function getCurrentPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function useTenantActiveLease(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-lease', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lts, error: ltErr } = await supabase
        .from('lease_tenant')
        .select('lease_id')
        .eq('tenant_id', tenantId!);
      if (ltErr) throw ltErr;

      const ids = lts.map(lt => lt.lease_id);
      if (ids.length === 0) return null;

      const { data, error } = await supabase
        .from('lease')
        .select(`
          id, monthly_rent, start_date, end_date, status,
          security_deposit, security_deposit_balance,
          unit:unit_id (id, unit_number, property:property_id (name))
        `)
        .in('id', ids)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCurrentRentPayment(leaseId?: string) {
  const { month, year } = getCurrentPeriod();
  return useQuery({
    queryKey: ['current-rent', leaseId, month, year],
    enabled: !!leaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('*')
        .eq('lease_id', leaseId!)
        .eq('period_month', month)
        .eq('period_year', year)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRecentTenantPayments(leaseId?: string) {
  return useQuery({
    queryKey: ['recent-tenant-payments', leaseId],
    enabled: !!leaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('*')
        .eq('lease_id', leaseId!)
        .in('status', ['paid'])
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTenantUtilityBills(unitId?: string) {
  return useQuery({
    queryKey: ['tenant-bills', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utility_bill')
        .select('*')
        .eq('unit_id', unitId!)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllTenantPayments(leaseId?: string) {
  return useQuery({
    queryKey: ['all-tenant-payments', leaseId],
    enabled: !!leaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('*')
        .eq('lease_id', leaseId!)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllTenantBills(unitId?: string) {
  return useQuery({
    queryKey: ['all-tenant-bills', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utility_bill')
        .select('*')
        .eq('unit_id', unitId!)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllTenantRequests(unitId?: string) {
  return useQuery({
    queryKey: ['all-tenant-requests', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select('id, title, status, priority, category, created_at, resolved_at')
        .eq('unit_id', unitId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTenantActiveRequests(unitId?: string) {
  return useQuery({
    queryKey: ['tenant-requests', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select('id, title, status, priority, created_at')
        .eq('unit_id', unitId!)
        .not('status', 'in', '(resolved,closed)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
