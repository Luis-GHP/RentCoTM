import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { currentPeriod } from '../domain/periods';
import { paymentCollectionBuckets } from '../domain/payments';

export type PropertyType = 'apartment' | 'house' | 'condo' | 'boarding_house' | 'commercial';
export type ElectricProvider = 'meralco' | 'veco' | 'dlpc' | 'beneco' | 'neeco' | 'manual';
export type UnitType = 'studio' | '1br' | '2br' | '3br' | 'room' | 'bedspace' | 'whole_unit';
export type UnitStatus = 'vacant' | 'occupied' | 'under_maintenance';

export type PropertyWithUnits = {
  id: string;
  name: string;
  address: string;
  electric_provider: string | null;
  default_rate_per_kwh: number | null;
  created_at: string;
  unit: { id: string; status: string }[];
};

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async (): Promise<PropertyWithUnits[]> => {
      const { data, error } = await supabase
        .from('property')
        .select('id, name, address, electric_provider, default_rate_per_kwh, created_at, unit(id, status)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PropertyWithUnits[];
    },
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      address: string;
      type: PropertyType;
      electricProvider: ElectricProvider;
      defaultRatePerKwh: number | null;
    }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You must be signed in to add a property.');

      const { data: profile, error: profileError } = await supabase
        .from('user_profile')
        .select('landlord_id')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.landlord_id) throw new Error('Landlord profile not found.');

      const { data, error } = await supabase
        .from('property')
        .insert({
          landlord_id: profile.landlord_id,
          name: params.name.trim(),
          address: params.address.trim(),
          type: params.type,
          electric_provider: params.electricProvider,
          default_rate_per_kwh: params.defaultRatePerKwh,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: id => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      propertyId: string;
      name: string;
      address: string;
      type: PropertyType;
      electricProvider: ElectricProvider;
      defaultRatePerKwh: number | null;
    }) => {
      const { error } = await supabase
        .from('property')
        .update({
          name: params.name.trim(),
          address: params.address.trim(),
          type: params.type,
          electric_provider: params.electricProvider,
          default_rate_per_kwh: params.defaultRatePerKwh,
        })
        .eq('id', params.propertyId);
      if (error) throw error;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', params.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] });
    },
  });
}

export type UnitSummary = {
  id: string;
  unit_number: string;
  type: string | null;
  floor: string | null;
  monthly_rent: number;
  status: string;
  lease: {
    id: string;
    unit_id?: string;
    status: string;
    lease_tenant: { role: string; tenant: { id: string; name: string } | null }[];
  }[];
  openMaintenanceCount: number;
};

export type PropertyDetail = {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  electric_provider: string | null;
  default_rate_per_kwh: number | null;
  unit: UnitSummary[];
};

export function useProperty(id?: string) {
  return useQuery({
    queryKey: ['property', id],
    enabled: !!id,
    queryFn: async (): Promise<PropertyDetail> => {
      const { data, error } = await supabase
        .from('property')
        .select(`
          id, name, address, type, electric_provider, default_rate_per_kwh,
          unit (
            id, unit_number, type, floor, monthly_rent, status
          )
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;

      const property = data as Omit<PropertyDetail, 'unit'> & {
        unit: Omit<UnitSummary, 'lease' | 'openMaintenanceCount'>[];
      };
      const units = (property.unit ?? []).map(unit => ({ ...unit, lease: [], openMaintenanceCount: 0 }));

      if (units.length === 0) {
        return { ...property, unit: units };
      }

      const [{ data: leases, error: leaseError }, { data: maintenance, error: maintenanceError }] = await Promise.all([
        supabase
        .from('lease')
        .select(`
          id, unit_id, status,
          lease_tenant (role, tenant:tenant_id (id, name))
        `)
        .in('unit_id', units.map(unit => unit.id))
          .eq('status', 'active'),
        supabase
          .from('maintenance_request')
          .select('id, unit_id')
          .in('unit_id', units.map(unit => unit.id))
          .neq('status', 'closed'),
      ]);

      if (leaseError) {
        console.warn('Could not enrich property units with tenant names', leaseError);
        return { ...property, unit: units };
      }

      if (maintenanceError) {
        console.warn('Could not enrich property units with maintenance counts', maintenanceError);
      }

      const leasesByUnit = new Map<string, UnitSummary['lease']>();
      const leaseRows = (leases ?? []) as unknown as UnitSummary['lease'];
      for (const lease of leaseRows) {
        if (!lease.unit_id) continue;
        const current = leasesByUnit.get(lease.unit_id) ?? [];
        current.push(lease);
        leasesByUnit.set(lease.unit_id, current);
      }

      const maintenanceCounts = new Map<string, number>();
      for (const request of (maintenance ?? []) as { unit_id?: string }[]) {
        if (!request.unit_id) continue;
        maintenanceCounts.set(request.unit_id, (maintenanceCounts.get(request.unit_id) ?? 0) + 1);
      }

      return {
        ...property,
        unit: units.map(unit => ({
          ...unit,
          lease: leasesByUnit.get(unit.id) ?? [],
          openMaintenanceCount: maintenanceCounts.get(unit.id) ?? 0,
        })),
      };
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unitId: string;
      propertyId?: string | null;
      unitNumber: string;
      type: UnitType;
      floor: string | null;
      monthlyRent: number;
    }) => {
      const { error } = await supabase
        .from('unit')
        .update({
          unit_number: params.unitNumber.trim(),
          type: params.type,
          floor: params.floor?.trim() || null,
          monthly_rent: params.monthlyRent,
        })
        .eq('id', params.unitId);
      if (error) throw error;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (params.propertyId) queryClient.invalidateQueries({ queryKey: ['property', params.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['unit', params.unitId] });
    },
  });
}

export function useUpdateUnitStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { unitId: string; propertyId?: string | null; status: UnitStatus }) => {
      const { error } = await supabase.rpc('set_unit_status', {
        p_unit_id: params.unitId,
        p_status: params.status,
      });
      if (error) throw error;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (params.propertyId) queryClient.invalidateQueries({ queryKey: ['property', params.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['unit', params.unitId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] });
    },
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      propertyId: string;
      unitNumber: string;
      type: UnitType;
      floor: string | null;
      monthlyRent: number;
    }) => {
      const { data, error } = await supabase
        .from('unit')
        .insert({
          property_id: params.propertyId,
          unit_number: params.unitNumber.trim(),
          type: params.type,
          floor: params.floor?.trim() || null,
          monthly_rent: params.monthlyRent,
          status: 'vacant',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (unitId, params) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', params.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['unit', unitId] });
    },
  });
}

export type UnitDetail = {
  id: string;
  unit_number: string;
  type: string | null;
  floor: string | null;
  monthly_rent: number;
  status: string;
  property: { id: string; name: string } | null;
  lease: {
    id: string;
    status: string;
    monthly_rent: number;
    start_date: string;
    end_date: string;
    security_deposit: number;
    security_deposit_balance: number;
    is_rent_controlled: boolean;
    lease_tenant: {
      role: string;
      tenant: { id: string; name: string; phone: string; email: string | null } | null;
    }[];
  }[];
};

export function useUnit(unitId?: string) {
  return useQuery({
    queryKey: ['unit', unitId],
    enabled: !!unitId,
    queryFn: async (): Promise<UnitDetail> => {
      const { data, error } = await supabase
        .from('unit')
        .select(`
          id, unit_number, type, floor, monthly_rent, status,
          property:property_id (id, name),
          lease (
            id, status, monthly_rent, start_date, end_date,
            security_deposit, security_deposit_balance, is_rent_controlled,
            lease_tenant (role, tenant:tenant_id (id, name, phone, email))
          )
        `)
        .eq('id', unitId!)
        .single();
      if (error) throw error;
      return data as unknown as UnitDetail;
    },
  });
}

export function useUnitCurrentRentPayment(leaseId?: string) {
  const { month, year } = currentPeriod();
  return useQuery({
    queryKey: ['unit-current-rent-payment', leaseId, month, year],
    enabled: !!leaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('id, status, amount_due, amount_paid, period_month, period_year')
        .eq('lease_id', leaseId!)
        .eq('period_month', month)
        .eq('period_year', year)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type PropertyIncomeSummary = {
  periodMonth: number;
  periodYear: number;
  activeLeaseCount: number;
  expectedRent: number;
  collected: number;
  pending: number;
  overdue: number;
};

export function usePropertyIncomeSummary(propertyId?: string, month?: number, year?: number) {
  const period = currentPeriod();
  const m = month ?? period.month;
  const y = year ?? period.year;

  return useQuery({
    queryKey: ['property-income-summary', propertyId, m, y],
    enabled: !!propertyId,
    queryFn: async (): Promise<PropertyIncomeSummary> => {
      const { data: units, error: unitError } = await supabase
        .from('unit')
        .select('id')
        .eq('property_id', propertyId!);
      if (unitError) throw unitError;

      const unitIds = (units ?? []).map(unit => unit.id);
      if (unitIds.length === 0) {
        return { periodMonth: m, periodYear: y, activeLeaseCount: 0, expectedRent: 0, collected: 0, pending: 0, overdue: 0 };
      }

      const { data: leases, error: leaseError } = await supabase
        .from('lease')
        .select('id, monthly_rent')
        .in('unit_id', unitIds)
        .eq('status', 'active');
      if (leaseError) throw leaseError;

      const activeLeases = (leases ?? []) as { id: string; monthly_rent: number }[];
      const leaseIds = activeLeases.map(lease => lease.id);
      const expectedRent = activeLeases.reduce((sum, lease) => sum + Number(lease.monthly_rent ?? 0), 0);

      if (leaseIds.length === 0) {
        return { periodMonth: m, periodYear: y, activeLeaseCount: 0, expectedRent, collected: 0, pending: 0, overdue: 0 };
      }

      const { data: payments, error: paymentError } = await supabase
        .from('rent_payment')
        .select('lease_id, status, amount_due, amount_paid')
        .in('lease_id', leaseIds)
        .eq('period_month', m)
        .eq('period_year', y);
      if (paymentError) throw paymentError;

      const recordedLeaseIds = new Set<string>();
      const totals = { collected: 0, pending: 0, overdue: 0 };
      for (const payment of payments ?? []) {
        recordedLeaseIds.add(payment.lease_id);
        const buckets = paymentCollectionBuckets(payment);
        totals.collected += buckets.collected;
        totals.pending += buckets.pending;
        totals.overdue += buckets.overdue;
      }

      const missingPending = activeLeases
        .filter(lease => !recordedLeaseIds.has(lease.id))
        .reduce((sum, lease) => sum + Number(lease.monthly_rent ?? 0), 0);

      return {
        periodMonth: m,
        periodYear: y,
        activeLeaseCount: activeLeases.length,
        expectedRent,
        collected: totals.collected,
        pending: totals.pending + missingPending,
        overdue: totals.overdue,
      };
    },
  });
}

export type UnitPaymentHistoryRow = {
  id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  status: string;
  or_number: string | null;
  payment_date: string | null;
};

export function useUnitPaymentHistory(leaseId?: string, limit = 4) {
  return useQuery({
    queryKey: ['unit-payment-history', leaseId, limit],
    enabled: !!leaseId,
    queryFn: async (): Promise<UnitPaymentHistoryRow[]> => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('id, period_month, period_year, amount_due, amount_paid, status, or_number, payment_date')
        .eq('lease_id', leaseId!)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as UnitPaymentHistoryRow[];
    },
  });
}

export type UnitUtilityBillHistoryRow = {
  id: string;
  period_month: number;
  period_year: number;
  utility_type: string;
  provider: string;
  amount: number;
  status: string;
  confirmed_at: string | null;
};

export function useUnitUtilityBillHistory(unitId?: string, limit = 4) {
  return useQuery({
    queryKey: ['unit-utility-bills', unitId, limit],
    enabled: !!unitId,
    queryFn: async (): Promise<UnitUtilityBillHistoryRow[]> => {
      const { data, error } = await supabase
        .from('utility_bill')
        .select('id, period_month, period_year, utility_type, provider, amount, status, confirmed_at')
        .eq('unit_id', unitId!)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as UnitUtilityBillHistoryRow[];
    },
  });
}
