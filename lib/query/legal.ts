import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AccountDeletionStatus =
  | 'requested'
  | 'in_review'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type AccountDeletionRequest = {
  id: string;
  user_id: string;
  role: 'landlord' | 'tenant';
  status: AccountDeletionStatus;
  reason: string | null;
  requested_at: string;
  completed_at: string | null;
};

type RpcDeletionRequest = {
  request_id: string;
  request_status: AccountDeletionStatus;
  requested_at: string;
};

export function accountDeletionStatusLabel(status?: AccountDeletionStatus | null) {
  if (status === 'requested') return 'Requested';
  if (status === 'in_review') return 'In Review';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'rejected') return 'Rejected';
  return 'Not Requested';
}

export function isOpenAccountDeletionRequest(status?: AccountDeletionStatus | null) {
  return status === 'requested' || status === 'in_review';
}

export function friendlyDeletionRequestError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (
    lower.includes('request_account_deletion') ||
    lower.includes('account_deletion_request') ||
    lower.includes('schema cache') ||
    lower.includes('function') ||
    lower.includes('relation')
  ) {
    return 'Account deletion requests are not ready yet. Run SQL 27 in Supabase, then reload and try again.';
  }
  return 'Could not submit this request right now. Please try again.';
}

export function useOwnAccountDeletionRequest() {
  return useQuery({
    queryKey: ['account-deletion-request'],
    queryFn: async (): Promise<AccountDeletionRequest | null> => {
      const { data, error } = await supabase
        .from('account_deletion_request')
        .select('id, user_id, role, status, reason, requested_at, completed_at')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AccountDeletionRequest | null;
    },
    retry: false,
  });
}

export function useRequestAccountDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string): Promise<RpcDeletionRequest> => {
      const trimmedReason = reason?.trim() || null;
      const { data, error } = await supabase.rpc('request_account_deletion', {
        p_reason: trimmedReason,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.request_id) throw new Error('Account deletion request was not created.');
      return result as RpcDeletionRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-deletion-request'] });
    },
  });
}
