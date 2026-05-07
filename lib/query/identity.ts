import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { notifyTenantForTenant } from '../notifications';

export type TenantIdentityStatus =
  | 'not_started'
  | 'started'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'declined'
  | 'resubmitted'
  | 'expired'
  | 'abandoned'
  | 'kyc_expired'
  | 'error';

export type TenantIdentityVerification = {
  id: string;
  tenant_id: string;
  provider: 'didit';
  provider_session_id: string | null;
  provider_session_token: string | null;
  workflow_id: string | null;
  status: TenantIdentityStatus;
  provider_status: string | null;
  verification_url: string | null;
  vendor_data: string | null;
  verified_name: string | null;
  document_type: string | null;
  document_number_last4: string | null;
  issuing_country: string | null;
  features: unknown[];
  decision: Record<string, unknown>;
  resubmit_info: Record<string, unknown> | null;
  review_message: string | null;
  last_error: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const IDENTITY_SAFE_COLUMNS = [
  'id',
  'tenant_id',
  'provider',
  'workflow_id',
  'status',
  'provider_status',
  'vendor_data',
  'verified_name',
  'document_type',
  'document_number_last4',
  'issuing_country',
  'review_message',
  'last_error',
  'started_at',
  'submitted_at',
  'completed_at',
  'created_at',
  'updated_at',
].join(',');

function normalizeIdentityRow(row: Partial<TenantIdentityVerification> | null): TenantIdentityVerification | null {
  if (!row) return null;
  return {
    id: row.id!,
    tenant_id: row.tenant_id!,
    provider: 'didit',
    provider_session_id: row.provider_session_id ?? null,
    provider_session_token: row.provider_session_token ?? null,
    workflow_id: row.workflow_id ?? null,
    status: row.status ?? 'not_started',
    provider_status: row.provider_status ?? null,
    verification_url: row.verification_url ?? null,
    vendor_data: row.vendor_data ?? null,
    verified_name: row.verified_name ?? null,
    document_type: row.document_type ?? null,
    document_number_last4: row.document_number_last4 ?? null,
    issuing_country: row.issuing_country ?? null,
    features: row.features ?? [],
    decision: row.decision ?? {},
    resubmit_info: row.resubmit_info ?? null,
    review_message: row.review_message ?? null,
    last_error: row.last_error ?? null,
    started_at: row.started_at ?? null,
    submitted_at: row.submitted_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at!,
    updated_at: row.updated_at!,
  };
}

async function edgeFunctionMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json();
      if (typeof payload?.message === 'string') return payload.message;
      if (typeof payload?.error === 'string') return payload.error;
    } catch {
      // Fall through to generic message.
    }
  }
  if (error instanceof Error && error.message !== 'Edge Function returned a non-2xx status code') {
    return error.message;
  }
  return fallback;
}

export function identityStatusLabel(status?: string | null) {
  if (!status) return 'Not Requested';
  if (status === 'approved') return 'Verified';
  if (status === 'in_review') return 'In Review';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'started' || status === 'not_started') return 'Not Started';
  if (status === 'resubmitted') return 'Retry Needed';
  if (status === 'declined') return 'Declined';
  if (status === 'expired') return 'Expired';
  if (status === 'abandoned') return 'Abandoned';
  if (status === 'kyc_expired') return 'Expired';
  if (status === 'error') return 'Needs Attention';
  return 'Not Requested';
}

export function identityStatusTone(status?: string | null) {
  if (status === 'approved') return { bg: '#EAF7EF', text: '#14804A', icon: 'checkmark-circle' as const };
  if (status === 'in_review' || status === 'in_progress' || status === 'resubmitted') return { bg: '#FFFBEB', text: '#B45309', icon: 'time-outline' as const };
  if (['declined', 'expired', 'abandoned', 'kyc_expired', 'error'].includes(status ?? '')) {
    return { bg: '#FEF2F2', text: '#B91C1C', icon: 'alert-circle-outline' as const };
  }
  return { bg: '#F1EFEC', text: '#6B7280', icon: 'shield-checkmark-outline' as const };
}

export function useTenantIdentityVerification(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-identity-verification', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantIdentityVerification | null> => {
      const { data, error } = await supabase
        .from('tenant_identity_verification')
        .select(IDENTITY_SAFE_COLUMNS)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return normalizeIdentityRow(data as Partial<TenantIdentityVerification> | null);
    },
  });
}

export function useCreateDiditSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { callbackUrl?: string }) => {
      const { data, error } = await supabase.functions.invoke('create-didit-session', {
        body: { callback_url: params?.callbackUrl },
      });
      if (error) throw new Error(await edgeFunctionMessage(error, 'Could not start identity verification.'));
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error) throw new Error(result.message ?? 'Could not start identity verification.');
      return normalizeIdentityRow(result?.data as Partial<TenantIdentityVerification>)!;
    },
    onSuccess: data => {
      queryClient.setQueryData(['tenant-identity-verification', data.tenant_id], data);
      queryClient.invalidateQueries({ queryKey: ['tenant-identity-verification', data.tenant_id] });
    },
  });
}

export function useRequestTenantIdentityVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error } = await supabase.rpc('request_tenant_identity_verification', {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: (_data, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-identity-verification', tenantId] });
      void notifyTenantForTenant(tenantId, {
        title: 'Identity verification requested',
        body: 'Your landlord requested tenant identity verification.',
        data: {
          type: 'identity_verification_requested',
          route: '/(tenant)/identity',
          tenant_id: tenantId,
        },
      });
    },
  });
}

export function useSyncDiditSession(tenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-didit-session');
      if (error) throw new Error(await edgeFunctionMessage(error, 'Could not refresh verification.'));
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error) throw new Error(result.message ?? 'Could not refresh verification.');
      return normalizeIdentityRow(result?.data as Partial<TenantIdentityVerification> | null);
    },
    onSuccess: data => {
      if (data) {
        queryClient.setQueryData(['tenant-identity-verification', data.tenant_id], data);
        queryClient.invalidateQueries({ queryKey: ['tenant-identity-verification', data.tenant_id] });
      } else if (tenantId) {
        queryClient.invalidateQueries({ queryKey: ['tenant-identity-verification', tenantId] });
      }
    },
  });
}
