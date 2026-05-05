import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type MaintenanceRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  unit: { unit_number: string; property: { name: string } | null } | null;
};

type Filter = 'all' | 'open' | 'in_progress' | 'resolved';

export function useMaintenanceRequests(filter: Filter = 'all') {
  return useQuery({
    queryKey: ['maintenance-requests', filter],
    queryFn: async (): Promise<MaintenanceRow[]> => {
      let query = supabase
        .from('maintenance_request')
        .select(`
          id, title, category, priority, status, created_at, resolved_at,
          unit:unit_id (unit_number, property:property_id (name))
        `)
        .order('created_at', { ascending: false });

      if (filter === 'open')        query = query.in('status', ['open', 'assigned']);
      if (filter === 'in_progress') query = query.eq('status', 'in_progress');
      if (filter === 'resolved')    query = query.in('status', ['resolved', 'closed']);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MaintenanceRow[];
    },
  });
}

export type MaintenanceDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  unit: {
    id: string;
    unit_number: string;
    property: { id: string; name: string } | null;
  } | null;
  tenant: { id: string; name: string } | null;
};

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export function useMaintenanceRequest(id?: string) {
  return useQuery({
    queryKey: ['maintenance-request', id],
    enabled: !!id,
    queryFn: async (): Promise<MaintenanceDetail> => {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select(`
          id, title, description, category, priority, status, created_at, resolved_at,
          unit:unit_id (id, unit_number, property:property_id (id, name)),
          tenant:tenant_id (id, name)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as MaintenanceDetail;
    },
  });
}

export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();
      if (status !== 'resolved') updates.resolved_at = null;

      const { error } = await supabase
        .from('maintenance_request')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', id] });
    },
  });
}
