import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File as ExpoFile } from 'expo-file-system';
import { supabase } from '../supabase';
import { Tenant } from '../types';
import { createStorageRef, resolveStorageUrl } from '../storage';

export type TenantListFilter = 'active' | 'inactive';

export type LandlordTenantRow = {
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string;
  gov_id_type: string | null;
  gov_id_number: string | null;
  is_active: boolean;
  lease_id: string | null;
  unit_id: string | null;
  unit_number: string | null;
  property_name: string | null;
  monthly_rent: number | null;
  lease_status: string | null;
};

export type TenantPaymentHistoryRow = {
  id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  status: string;
  or_number: string | null;
  payment_date: string | null;
};

export type TenantMaintenanceHistoryRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
};

export type TenantDocumentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  uploaded_by: 'landlord' | 'tenant';
  uploaded_at: string;
};

export type TenantLeaseSummary = {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  security_deposit_balance: number;
  is_rent_controlled: boolean;
  status: string;
  unit: { id: string; unit_number: string; property: { id: string; name: string } | null } | null;
};

export type TenantDetail = {
  tenant: Tenant;
  row: LandlordTenantRow | null;
  activeLease: TenantLeaseSummary | null;
  payments: TenantPaymentHistoryRow[];
  maintenance: TenantMaintenanceHistoryRow[];
  documents: TenantDocumentRow[];
};

export type VacantUnitForInvite = {
  id: string;
  unit_number: string;
  type: string | null;
  monthly_rent: number;
  property: { id: string; name: string } | null;
  activeInvite?: { expires_at: string };
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 30000) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function loadFileArrayBuffer(uri: string) {
  try {
    const file = new ExpoFile(uri);
    const arrayBuffer = await withTimeout(file.arrayBuffer(), 'The selected file took too long to read.');
    if (arrayBuffer.byteLength > 0) return arrayBuffer;
  } catch {
    // Fall through for web blob/content URIs.
  }

  const response = await withTimeout(fetch(uri), 'The selected file took too long to open.');
  const arrayBuffer = await withTimeout(response.arrayBuffer(), 'The selected file took too long to read.');
  if (arrayBuffer.byteLength === 0) throw new Error('The selected file is empty.');
  return arrayBuffer;
}

async function uploadDocumentFile(uri: string, path: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to upload tenant documents.');

  const arrayBuffer = await loadFileArrayBuffer(uri);
  const scopedPath = `users/${user.id}/${path}`;
  const { error } = await withTimeout(
    supabase.storage.from('documents').upload(scopedPath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
    'Upload took too long. Check your connection and try again.'
  );
  if (error) throw error;
  return createStorageRef('documents', scopedPath);
}

export function useTenant(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Tenant> => {
      const { data, error } = await supabase
        .from('tenant')
        .select('*')
        .eq('id', tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAllTenants(filter: TenantListFilter = 'active', search = '') {
  return useQuery({
    queryKey: ['landlord-tenants', filter, search],
    queryFn: async (): Promise<LandlordTenantRow[]> => {
      const { data, error } = await supabase.rpc('list_landlord_tenants');
      if (error) throw error;

      const q = search.trim().toLowerCase();
      const rows = (data ?? []) as unknown as LandlordTenantRow[];
      return rows.filter(row => {
        const matchesStatus = filter === 'active' ? row.is_active : !row.is_active;
        const matchesSearch =
          !q ||
          row.name.toLowerCase().includes(q) ||
          (row.unit_number ?? '').toLowerCase().includes(q) ||
          (row.property_name ?? '').toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      });
    },
  });
}

export function useVacantUnitsForInvite() {
  return useQuery({
    queryKey: ['vacant-units-for-invite'],
    queryFn: async (): Promise<VacantUnitForInvite[]> => {
      const [{ data: unitData, error: unitError }, { data: inviteData, error: inviteError }] = await Promise.all([
        supabase
          .from('unit')
          .select('id, unit_number, type, monthly_rent, property:property_id (id, name)')
          .eq('status', 'vacant')
          .order('unit_number', { ascending: true }),
        supabase
          .from('tenant_invite')
          .select('unit_id, expires_at')
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString()),
      ]);
      if (unitError) throw unitError;

      const activeByUnit = new Map<string, { expires_at: string }>();
      if (inviteError) {
        console.warn('Could not load active tenant invites', inviteError);
      } else {
        for (const invite of inviteData ?? []) {
          if (invite.unit_id) activeByUnit.set(invite.unit_id, { expires_at: invite.expires_at });
        }
      }

      return ((unitData ?? []) as any[]).map(unit => ({
        id: unit.id,
        unit_number: unit.unit_number,
        type: unit.type,
        monthly_rent: Number(unit.monthly_rent),
        property: normalizeOne(unit.property),
        activeInvite: activeByUnit.get(unit.id),
      }));
    },
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unitId: string;
      startDate: string;
      endDate: string;
      monthlyRent: number;
      securityDeposit: number;
      advanceMonths: number;
    }) => {
      const { data, error } = await supabase.rpc('create_landlord_invite', {
        p_unit_id: params.unitId,
        p_start_date: params.startDate,
        p_end_date: params.endDate,
        p_monthly_rent: params.monthlyRent,
        p_security_deposit: params.securityDeposit,
        p_advance_months: params.advanceMonths,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as {
        invite_id: string;
        tenant_id: string | null;
        token: string;
        expires_at: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacant-units-for-invite'] });
      queryClient.invalidateQueries({ queryKey: ['landlord-tenants'] });
    },
  });
}

export function useTenantDetail(tenantId?: string) {
  return useQuery({
    queryKey: ['landlord-tenant-detail', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantDetail> => {
      const [{ data: tenant, error: tenantError }, { data: roster, error: rosterError }] = await Promise.all([
        supabase.from('tenant').select('*').eq('id', tenantId!).single(),
        supabase.rpc('list_landlord_tenants'),
      ]);
      if (tenantError) throw tenantError;
      if (rosterError) throw rosterError;

      const rows = ((roster ?? []) as unknown as LandlordTenantRow[]).filter(row => row.tenant_id === tenantId);
      const row = rows.find(r => r.lease_status === 'active') ?? rows[0] ?? null;
      const leaseIds = rows.map(r => r.lease_id).filter(Boolean) as string[];
      const unitIds: string[] = [];

      let activeLease: TenantLeaseSummary | null = null;
      let payments: TenantPaymentHistoryRow[] = [];
      let maintenance: TenantMaintenanceHistoryRow[] = [];
      let documents: TenantDocumentRow[] = [];
      let utilityBillIds: string[] = [];

      if (leaseIds.length > 0) {
        const { data: leases, error: leaseError } = await supabase
          .from('lease')
          .select(`
            id, start_date, end_date, monthly_rent, security_deposit,
            security_deposit_balance, is_rent_controlled, status,
            unit:unit_id (id, unit_number, property:property_id (id, name))
          `)
          .in('id', leaseIds)
          .order('created_at', { ascending: false });
        if (leaseError) throw leaseError;
        const leaseRows = (leases ?? []) as any[];
        for (const lease of leaseRows) {
          const unit = normalizeOne(lease.unit);
          if (unit?.id) unitIds.push(unit.id);
        }
        const selected = leaseRows.find(l => l.status === 'active') ?? leaseRows[0] ?? null;
        if (selected) {
          activeLease = {
            ...selected,
            unit: selected.unit ? { ...normalizeOne(selected.unit), property: normalizeOne(normalizeOne(selected.unit)?.property) } : null,
          } as TenantLeaseSummary;
        }

        const { data: paymentData, error: paymentError } = await supabase
          .from('rent_payment')
          .select('id, period_month, period_year, amount_due, amount_paid, status, or_number, payment_date')
          .in('lease_id', leaseIds)
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false });
        if (paymentError) throw paymentError;
        payments = (paymentData ?? []) as TenantPaymentHistoryRow[];
      }

      const [{ data: maintenanceData, error: maintenanceError }, utilityResult] = await Promise.all([
        supabase
          .from('maintenance_request')
          .select('id, title, category, priority, status, created_at')
          .eq('reported_by', tenantId!)
          .order('created_at', { ascending: false }),
        unitIds.length > 0
          ? supabase
            .from('utility_bill')
            .select('id')
            .in('unit_id', unique(unitIds))
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (maintenanceError) throw maintenanceError;
      if (utilityResult.error) throw utilityResult.error;
      maintenance = (maintenanceData ?? []) as TenantMaintenanceHistoryRow[];
      utilityBillIds = ((utilityResult.data ?? []) as { id: string }[]).map(row => row.id);

      const documentScopes: { entityType: string; entityIds: string[] }[] = [
        { entityType: 'tenant', entityIds: [tenantId!] },
        { entityType: 'lease', entityIds: leaseIds },
        { entityType: 'rent_payment', entityIds: payments.map(payment => payment.id) },
        { entityType: 'maintenance_request', entityIds: maintenance.map(request => request.id) },
        { entityType: 'utility_bill', entityIds: utilityBillIds },
      ];
      const documentQueries = documentScopes
        .map(scope => ({ entityType: scope.entityType, entityIds: unique(scope.entityIds) }))
        .filter(scope => scope.entityIds.length > 0)
        .map(scope => supabase
          .from('document')
          .select('id, entity_type, entity_id, doc_type, file_url, file_name, uploaded_by, uploaded_at')
          .eq('entity_type', scope.entityType)
          .in('entity_id', scope.entityIds));

      const documentResults = await Promise.all(documentQueries);
      for (const result of documentResults) {
        if (result.error) throw result.error;
        documents.push(...((result.data ?? []) as TenantDocumentRow[]));
      }
      documents = documents.sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );
      documents = await Promise.all(documents.map(async doc => ({
        ...doc,
        file_url: await resolveStorageUrl(doc.file_url) ?? doc.file_url,
      })));

      return {
        tenant,
        row,
        activeLease,
        payments,
        maintenance,
        documents,
      };
    },
  });
}

export function useUpdateTenantProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tenantId: string; name: string; phone: string; email: string | null }) => {
      const { error } = await supabase
        .from('tenant')
        .update({
          name: params.name.trim(),
          phone: params.phone.trim(),
          email: params.email?.trim() || null,
        })
        .eq('id', params.tenantId);
      if (error) throw error;
    },
    onSuccess: (_data, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['landlord-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['landlord-tenant-detail', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });
}

export function useUploadTenantGovernmentId() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      idType: string;
      idNumber: string;
      frontUri?: string;
      backUri?: string;
    }) => {
      const { error: updateError } = await supabase
        .from('tenant')
        .update({
          gov_id_type: params.idType,
          gov_id_number: params.idNumber.trim(),
        })
        .eq('id', params.tenantId);
      if (updateError) throw updateError;

      const files = [
        { uri: params.frontUri, docType: 'gov_id_front', suffix: 'front' },
        { uri: params.backUri, docType: 'gov_id_back', suffix: 'back' },
      ].filter(file => !!file.uri) as { uri: string; docType: string; suffix: string }[];

      for (const file of files) {
        const path = `tenant/${params.tenantId}/${file.suffix}-${Date.now()}.jpg`;
        const fileUrl = await uploadDocumentFile(file.uri, path);
        const { error: docError } = await supabase.from('document').insert({
          entity_type: 'tenant',
          entity_id: params.tenantId,
          doc_type: file.docType,
          file_url: fileUrl,
          file_name: `${file.suffix}-id.jpg`,
          uploaded_by: 'landlord',
        });
        if (docError) throw docError;
      }
    },
    onSuccess: (_data, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['landlord-tenant-detail', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['documents', 'tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['document-center'] });
    },
  });
}

export function useSetTenantActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tenantId: string; isActive: boolean }) => {
      const { error } = await supabase.rpc('set_tenant_active', {
        p_tenant_id: params.tenantId,
        p_is_active: params.isActive,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['landlord-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['landlord-tenant-detail', tenantId] });
    },
  });
}

export function useRecordRentIncrease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { leaseId: string; newRent: number; effectiveDate: string; reason: string }) => {
      const { error } = await supabase.rpc('record_rent_increase', {
        p_lease_id: params.leaseId,
        p_new_rent: params.newRent,
        p_effective_date: params.effectiveDate,
        p_reason: params.reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['landlord-tenant-detail'] });
    },
  });
}
