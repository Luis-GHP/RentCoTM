import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { uploadDocumentFile } from './documents';
import { notifyLandlordsForMaintenanceRequest, notifyLandlordsForUtilityBill } from '../notifications';
import { getMonthName } from '../format';
import { currentPeriod } from '../domain/periods';
import { resolveStorageUrl } from '../storage';
import { getMaintenancePhotoSummaries } from './maintenance-photos';

export type TenantPaymentDetail = {
  id: string;
  lease_id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  status: string;
  confirmed_at: string | null;
  or_number: string | null;
  created_at: string;
  lease: {
    id: string;
    monthly_rent: number;
    unit: { id: string; unit_number: string; property: { name: string } | null } | null;
  } | null;
};

export type TenantUtilityBillDetail = {
  id: string;
  unit_id: string;
  period_month: number;
  period_year: number;
  utility_type: string;
  provider: string;
  reading_start: number | null;
  reading_end: number | null;
  kwh_consumed: number | null;
  rate_per_kwh: number | null;
  amount: number;
  status: string;
  bill_pdf_url: string | null;
  parsed_by: string | null;
  parse_confidence: string | null;
  uploaded_by: 'landlord' | 'tenant';
  confirmed_at: string | null;
  created_at: string;
  unit: { id: string; unit_number: string; property: { name: string } | null } | null;
};

export type TenantMaintenanceDetail = {
  id: string;
  unit_id: string;
  reported_by: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
  unit: { id: string; unit_number: string; property: { name: string } | null } | null;
};

export type TenantMaintenanceListRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  resolved_at: string | null;
  thumbnail_url: string | null;
  photo_count: number;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
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
          id, monthly_rent, start_date, end_date, status, created_at,
          security_deposit, security_deposit_balance,
          unit:unit_id (id, unit_number, property:property_id (id, name))
        `)
        .in('id', ids)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const lease = data as any;
      const unit = normalizeOne(lease.unit);
      const property = normalizeOne(unit?.property);
      return {
        ...lease,
        unit: unit ? { ...unit, property } : null,
      };
    },
  });
}

export function useCurrentRentPayment(leaseId?: string) {
  const { month, year } = currentPeriod();
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
        .eq('status', 'paid')
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
      const rows = (data ?? []) as TenantMaintenanceListRow[];
      const photos = await getMaintenancePhotoSummaries(rows.map(row => row.id));
      return rows.map(row => ({
        ...row,
        thumbnail_url: photos.get(row.id)?.thumbnail_url ?? null,
        photo_count: photos.get(row.id)?.photo_count ?? 0,
      }));
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

export function useTenantPayment(paymentId?: string) {
  return useQuery({
    queryKey: ['tenant-payment', paymentId],
    enabled: !!paymentId,
    queryFn: async (): Promise<TenantPaymentDetail> => {
      const { data, error } = await supabase
        .from('rent_payment')
        .select(`
          id, lease_id, period_month, period_year, amount_due, amount_paid,
          payment_date, payment_method, reference_number, status,
          confirmed_at, or_number, created_at,
          lease:lease_id (
            id, monthly_rent,
            unit:unit_id (id, unit_number, property:property_id (name))
          )
        `)
        .eq('id', paymentId!)
        .single();
      if (error) throw error;
      return data as unknown as TenantPaymentDetail;
    },
  });
}

export function useTenantUtilityBill(billId?: string) {
  return useQuery({
    queryKey: ['tenant-utility-bill', billId],
    enabled: !!billId,
    queryFn: async (): Promise<TenantUtilityBillDetail> => {
      const { data, error } = await supabase
        .from('utility_bill')
        .select(`
          id, unit_id, period_month, period_year, utility_type, provider,
          reading_start, reading_end, kwh_consumed, rate_per_kwh, amount,
          status, bill_pdf_url, parsed_by, parse_confidence, uploaded_by,
          confirmed_at, created_at,
          unit:unit_id (id, unit_number, property:property_id (name))
        `)
        .eq('id', billId!)
        .single();
      if (error) throw error;
      return {
        ...(data as unknown as TenantUtilityBillDetail),
        bill_pdf_url: await resolveStorageUrl((data as { bill_pdf_url: string | null }).bill_pdf_url),
      };
    },
  });
}

export function useSubmitUtilityBillPaymentReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bill: TenantUtilityBillDetail) => {
      const { error } = await withTimeout(
        supabase.rpc('submit_utility_bill_payment_review', {
          p_bill_id: bill.id,
        }),
        15000,
        'Submitting this receipt took too long. Check your connection and try again.'
      );
      if (error) throw error;

      void notifyLandlordsForUtilityBill(bill.id, {
        title: 'Utility payment submitted',
        body: `${getMonthName(bill.period_month)} ${bill.period_year} ${bill.utility_type} receipt is ready for verification.`,
        data: { type: 'utility_payment_submitted', route: `/(landlord)/utilities/${bill.id}`, utility_bill_id: bill.id },
      });
    },
    onSuccess: (_data, bill) => {
      queryClient.setQueryData<TenantUtilityBillDetail | undefined>(['tenant-utility-bill', bill.id], current => (
        current ? { ...current, status: 'payment_submitted' } : current
      ));
      queryClient.invalidateQueries({ queryKey: ['tenant-utility-bill', bill.id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-bills'] });
      queryClient.invalidateQueries({ queryKey: ['all-tenant-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', bill.id] });
    },
  });
}

export function useTenantMaintenanceRequest(requestId?: string) {
  return useQuery({
    queryKey: ['tenant-maintenance-request', requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<TenantMaintenanceDetail> => {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select(`
          id, unit_id, reported_by, title, description, category, priority,
          status, resolved_at, created_at,
          unit:unit_id (id, unit_number, property:property_id (name))
        `)
        .eq('id', requestId!)
        .single();
      if (error) throw error;
      return data as unknown as TenantMaintenanceDetail;
    },
  });
}

export function useRespondTenantMaintenanceResolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { requestId: string; fixed: boolean }) => {
      const { error } = await supabase.rpc('respond_to_maintenance_resolution', {
        p_request_id: params.requestId,
        p_fixed: params.fixed,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { requestId, fixed }) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-maintenance-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-tenant-requests'] });
      void notifyLandlordsForMaintenanceRequest(requestId, {
        title: 'Maintenance response',
        body: fixed
          ? 'A tenant confirmed the repair is fixed.'
          : 'A tenant said the repair still needs attention.',
        data: { type: 'maintenance_response', route: `/(landlord)/maintenance/${requestId}`, maintenance_id: requestId },
      });
    },
  });
}

export function useCreateTenantMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      title: string;
      description: string;
      category: string;
      priority: string;
      photos: { uri: string; fileName: string; contentType?: string }[];
    }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You must be signed in to submit a request.');

      const { data: profile, error: profileError } = await supabase
        .from('user_profile')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.tenant_id) throw new Error('Tenant profile not found.');

      const { data: leaseTenant, error: ltError } = await supabase
        .from('lease_tenant')
        .select('lease_id')
        .eq('tenant_id', profile.tenant_id);
      if (ltError) throw ltError;

      const leaseIds = (leaseTenant ?? []).map(row => row.lease_id);
      if (leaseIds.length === 0) throw new Error('No active lease found.');

      const { data: lease, error: leaseError } = await supabase
        .from('lease')
        .select('id, unit_id')
        .in('id', leaseIds)
        .eq('status', 'active')
        .single();
      if (leaseError) throw leaseError;
      if (!lease?.unit_id) throw new Error('No active unit found.');

      const { data: request, error: requestError } = await supabase
        .from('maintenance_request')
        .insert({
          unit_id: lease.unit_id,
          reported_by: profile.tenant_id,
          title: params.title.trim(),
          description: params.description.trim(),
          category: params.category,
          priority: params.priority,
          status: 'open',
        })
        .select('id, unit_id')
        .single();
      if (requestError) throw requestError;

      let failedPhotoCount = 0;
      for (const [index, photo] of params.photos.entries()) {
        try {
          const fileUrl = await uploadDocumentFile({
            uri: photo.uri,
            fileName: photo.fileName,
            contentType: photo.contentType,
            pathPrefix: `maintenance_request/${request.id}`,
          });
          const { error: docError } = await supabase.from('document').insert({
            entity_type: 'maintenance_request',
            entity_id: request.id,
            doc_type: 'photo',
            file_url: fileUrl,
            file_name: photo.fileName,
            sort_order: index,
            uploaded_by: 'tenant',
          });
          if (docError) throw docError;
        } catch (error) {
          failedPhotoCount += 1;
          console.warn('Could not upload maintenance photo', error);
        }
      }

      return { id: request.id as string, unitId: request.unit_id as string, failedPhotoCount };
    },
    onSuccess: (result, params) => {
      queryClient.invalidateQueries({ queryKey: ['all-tenant-requests'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-requests'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-maintenance-request', result.id] });
      queryClient.invalidateQueries({ queryKey: ['documents', 'maintenance_request', result.id] });
      queryClient.invalidateQueries({ queryKey: ['document-center'] });
      void notifyLandlordsForMaintenanceRequest(result.id, {
        title: 'New maintenance request',
        body: params.title.trim(),
        data: { type: 'maintenance_created', route: `/(landlord)/maintenance/${result.id}`, maintenance_id: result.id },
      });
    },
  });
}
